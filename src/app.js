// Random Round Timer — classic browser script (no ES modules).
// Requires the full DOM from index.html; every element is queried at load time.

/* --------------------------------------------------------------------------
 * Audio
 * ------------------------------------------------------------------------ */

let audioContext = null;

function initAudio() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;

  if (!audioContext) {
    try {
      audioContext = new AudioCtor();
    } catch (err) {
      console.error('Unable to create AudioContext', err);
      return null;
    }
  }

  if (audioContext.state === 'suspended' && typeof audioContext.resume === 'function') {
    audioContext.resume();
  }

  return audioContext;
}

// A single oscillator + gain envelope. Used by both the gong and the beep.
function playTone(startFrequency, endFrequency, peakGain, duration) {
  const ctx = initAudio();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.frequency.setValueAtTime(startFrequency, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    endFrequency,
    ctx.currentTime + duration * 0.66
  );

  gainNode.gain.setValueAtTime(peakGain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

// Low, long tone: session completion.
function playGong() {
  playTone(150, 80, 0.8, 1.2);
}

// Sustained high tone: round and break start.
function playLongBeep() {
  playTone(800, 800, 0.5, 1);
}

// Short high tone: pre-start countdown and the last 5 seconds of a phase.
function playBeep() {
  playTone(800, 800, 0.3, 0.2);
}

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// parseInt() that never returns NaN: falls back when the input is empty/invalid.
function toInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/* --------------------------------------------------------------------------
 * DOM
 * ------------------------------------------------------------------------ */

const optionsBtn = document.getElementById('optionsBtn');
const optionsModal = document.getElementById('optionsModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModalBtn');

const roundMinInput = document.getElementById('roundMin');
const roundMaxInput = document.getElementById('roundMax');
const breakMinInput = document.getElementById('breakMin');
const breakMaxInput = document.getElementById('breakMax');
const endConditionRadios = document.getElementsByName
  ? document.getElementsByName('endCondition')
  : [];
const roundsInput = document.getElementById('roundsInput');
const timeInput = document.getElementById('timeInput');
const roundCountInput = document.getElementById('roundCount');
const sessionMinutesInput = document.getElementById('sessionMinutes');
const countdownInput = document.getElementById('countdown');

const roundRangeDisplay = document.getElementById('roundRangeDisplay');
const breakRangeDisplay = document.getElementById('breakRangeDisplay');

const statusEl = document.getElementById('status');
const roundInfoEl = document.getElementById('roundInfo');
const sessionElapsedEl = document.getElementById('sessionElapsed');
const phaseLabelEl = document.getElementById('phaseLabel');
const timeDisplayEl = document.getElementById('timeDisplay');
const nextInfoEl = document.getElementById('nextInfo');

const startPauseBtn = document.getElementById('startPauseBtn');
const stopBtn = document.getElementById('stopBtn');

const PLAY_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
  <polygon points="5,3 19,12 5,21"></polygon>
</svg>`;
const PAUSE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
  <rect x="6" y="4" width="4" height="16"></rect>
  <rect x="14" y="4" width="4" height="16"></rect>
</svg>`;

/* --------------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------------ */

// phases: idle | countdown | round | break | done
let state = {
  running: false,
  paused: false,
  phase: 'idle',
  currentRound: 0,
  totalRounds: 0,
  endCondition: 'rounds',
  targetSessionSeconds: 0,
  sessionStartTime: null,
  sessionElapsedSeconds: 0,
  timeRemaining: 0,
  roundDuration: 0,
  breakDuration: 0,
  countdownTotal: 0,
  countdownRemaining: 0,
  config: { roundMin: 0, roundMax: 0, breakMin: 0, breakMax: 0 },
  intervalId: null,
  sessionIntervalId: null
};

/* --------------------------------------------------------------------------
 * Rendering
 * ------------------------------------------------------------------------ */

function setStatus(text, modifier) {
  statusEl.textContent = text;
  statusEl.className = modifier ? `meta-value ${modifier}` : 'meta-value';
}

function setCountdownActive(active) {
  timeDisplayEl.classList.toggle('countdown-active', Boolean(active));
}

function updateStartPauseButton() {
  if (!startPauseBtn) return;

  if (!state.running) {
    startPauseBtn.innerHTML = `${PLAY_ICON} Start`;
    startPauseBtn.className = 'btn btn-start';
  } else if (state.paused) {
    startPauseBtn.innerHTML = `${PLAY_ICON} Resume`;
    startPauseBtn.className = 'btn btn-start';
  } else {
    startPauseBtn.innerHTML = `${PAUSE_ICON} Pause`;
    startPauseBtn.className = 'btn btn-pause';
  }

  startPauseBtn.disabled = false;
}

function updateRangeDisplays() {
  if (roundRangeDisplay && roundMinInput && roundMaxInput) {
    roundRangeDisplay.textContent = `${roundMinInput.value}s - ${roundMaxInput.value}s`;
  }
  if (breakRangeDisplay && breakMinInput && breakMaxInput) {
    breakRangeDisplay.textContent = `${breakMinInput.value}s - ${breakMaxInput.value}s`;
  }
}

function syncEndConditionInputs() {
  const useTime = getEndCondition() === 'time';
  if (roundsInput) roundsInput.classList.toggle('hidden', useTime);
  if (timeInput) timeInput.classList.toggle('hidden', !useTime);
}

function getEndCondition() {
  for (const radio of endConditionRadios) {
    if (radio.checked) return radio.value;
  }
  return 'rounds';
}

/* --------------------------------------------------------------------------
 * Timers
 * ------------------------------------------------------------------------ */

function stopPhaseInterval() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}

function stopAllIntervals() {
  stopPhaseInterval();
  if (state.sessionIntervalId) {
    clearInterval(state.sessionIntervalId);
    state.sessionIntervalId = null;
  }
}

function startSessionInterval() {
  if (state.sessionIntervalId) clearInterval(state.sessionIntervalId);
  state.sessionIntervalId = setInterval(updateSessionElapsed, 1000);
}

// The session clock starts with round 1, so the pre-start countdown does not
// count against the elapsed display or a time-based session budget.
function beginSessionClock() {
  if (state.sessionStartTime !== null) return;
  state.sessionStartTime = Date.now();
  startSessionInterval();
}

function updateSessionElapsed() {
  if (!state.running || state.paused || state.sessionStartTime === null) return;

  // Keep sub-second precision internally; formatTime() floors for display.
  state.sessionElapsedSeconds = (Date.now() - state.sessionStartTime) / 1000;
  if (sessionElapsedEl) sessionElapsedEl.textContent = formatTime(state.sessionElapsedSeconds);

  if (
    state.endCondition === 'time' &&
    state.sessionElapsedSeconds >= state.targetSessionSeconds
  ) {
    endSession('Time limit reached');
  }
}

function runCountdownInterval() {
  stopPhaseInterval();

  state.intervalId = setInterval(() => {
    if (!state.running || state.paused) return;

    state.countdownRemaining -= 1;
    if (timeDisplayEl) timeDisplayEl.textContent = formatTime(state.countdownRemaining);

    if (state.countdownRemaining <= 0) {
      stopPhaseInterval();
      startRound();
      return;
    }

    playBeep();
  }, 1000);
}

function runPhaseInterval(onComplete) {
  stopPhaseInterval();

  state.intervalId = setInterval(() => {
    if (!state.running || state.paused) return;

    state.timeRemaining -= 1;
    if (timeDisplayEl) timeDisplayEl.textContent = formatTime(state.timeRemaining);

    if (state.timeRemaining <= 0) {
      stopPhaseInterval();
      setCountdownActive(false);
      onComplete();
      return;
    }

    // Beep during the final five seconds of the phase.
    if (state.timeRemaining <= 5) {
      setCountdownActive(true);
      playBeep();
    }
  }, 1000);
}

function startPhaseTimer(duration, onComplete) {
  state.timeRemaining = duration;
  if (timeDisplayEl) timeDisplayEl.textContent = formatTime(duration);
  setCountdownActive(false);
  runPhaseInterval(onComplete);
}

function resumePhaseTimer() {
  setCountdownActive(state.timeRemaining > 0 && state.timeRemaining <= 5);

  if (state.phase === 'round') {
    runPhaseInterval(nextBreak);
  } else if (state.phase === 'break') {
    runPhaseInterval(nextRound);
  }
}

/* --------------------------------------------------------------------------
 * Session flow
 * ------------------------------------------------------------------------ */

function readSessionConfig() {
  const config = {
    roundMin: toInt(roundMinInput && roundMinInput.value, NaN),
    roundMax: toInt(roundMaxInput && roundMaxInput.value, NaN),
    breakMin: toInt(breakMinInput && breakMinInput.value, NaN),
    breakMax: toInt(breakMaxInput && breakMaxInput.value, NaN)
  };

  if (Object.values(config).some((value) => !Number.isFinite(value))) {
    window.alert('Please enter valid numbers for round and break times');
    return null;
  }

  if (config.roundMin < 1 || config.breakMin < 0) {
    window.alert('Round times must be at least 1 second');
    return null;
  }

  if (config.roundMin > config.roundMax || config.breakMin > config.breakMax) {
    window.alert('Min time cannot be greater than max time');
    return null;
  }

  return config;
}

function startSession() {
  const config = readSessionConfig();
  if (!config) return;

  const endCondition = getEndCondition();
  const totalRounds = toInt(roundCountInput && roundCountInput.value, 0);
  const sessionMinutes = toInt(sessionMinutesInput && sessionMinutesInput.value, 0);

  if (endCondition === 'rounds' && totalRounds < 1) {
    window.alert('Number of rounds must be at least 1');
    return;
  }
  if (endCondition === 'time' && sessionMinutes < 1) {
    window.alert('Session time must be at least 1 minute');
    return;
  }

  stopAllIntervals();

  Object.assign(state, {
    running: true,
    paused: false,
    phase: 'idle',
    currentRound: 0,
    totalRounds,
    endCondition,
    targetSessionSeconds: sessionMinutes * 60,
    sessionStartTime: null,
    sessionElapsedSeconds: 0,
    timeRemaining: 0,
    roundDuration: 0,
    breakDuration: 0,
    countdownTotal: Math.max(0, toInt(countdownInput && countdownInput.value, 5)),
    countdownRemaining: 0,
    config
  });

  if (sessionElapsedEl) sessionElapsedEl.textContent = '00:00';
  if (roundInfoEl) roundInfoEl.textContent = '- / -';
  if (nextInfoEl) nextInfoEl.textContent = '';
  if (timeDisplayEl) timeDisplayEl.textContent = '00:00';
  setCountdownActive(false);

  updateStartPauseButton();

  if (state.countdownTotal > 0) {
    startCountdown();
  } else {
    startRound();
  }
}

function startCountdown() {
  state.phase = 'countdown';
  state.countdownRemaining = state.countdownTotal;

  if (phaseLabelEl) phaseLabelEl.textContent = 'GET READY';
  setStatus('Preparing', 'status-ready');
  if (timeDisplayEl) timeDisplayEl.textContent = formatTime(state.countdownRemaining);
  setCountdownActive(true);
  playBeep();

  runCountdownInterval();
}

function startRound() {
  if (!state.running) return;

  state.currentRound += 1;

  if (state.endCondition === 'rounds' && state.currentRound > state.totalRounds) {
    endSession('All rounds completed');
    return;
  }

  beginSessionClock();

  state.phase = 'round';
  state.roundDuration = randomInRange(state.config.roundMin, state.config.roundMax);

  if (phaseLabelEl) phaseLabelEl.textContent = `ROUND ${state.currentRound}`;
  if (roundInfoEl) {
    roundInfoEl.textContent =
      `${state.currentRound} / ` +
      (state.endCondition === 'rounds' ? state.totalRounds : '∞');
  }
  setStatus('In Progress', 'status-running');
  setCountdownActive(false);

  playLongBeep();
  startPhaseTimer(state.roundDuration, nextBreak);
}

function nextRound() {
  if (!state.running) return;

  if (
    state.endCondition === 'time' &&
    state.sessionElapsedSeconds >= state.targetSessionSeconds
  ) {
    endSession('Time limit reached');
    return;
  }

  startRound();
}

function nextBreak() {
  if (!state.running) return;

  // No break after the final round.
  if (state.endCondition === 'rounds' && state.currentRound >= state.totalRounds) {
    endSession('Session complete');
    return;
  }

  const breakDuration = randomInRange(state.config.breakMin, state.config.breakMax);

  // Don't start a break that would run past the session time limit. A break
  // that ends exactly on the limit is allowed (strictly greater-than).
  if (
    state.endCondition === 'time' &&
    state.sessionElapsedSeconds + breakDuration > state.targetSessionSeconds
  ) {
    endSession('Time limit reached');
    return;
  }

  state.breakDuration = breakDuration;
  startBreak();
}

function startBreak() {
  if (!state.running) return;

  // A zero-second break would otherwise sit at 00:00 for a tick.
  if (state.breakDuration <= 0) {
    nextRound();
    return;
  }

  state.phase = 'break';

  if (phaseLabelEl) phaseLabelEl.textContent = 'BREAK';
  setStatus('Rest', 'status-rest');
  setCountdownActive(false);

  playLongBeep();
  startPhaseTimer(state.breakDuration, nextRound);
}

function pauseSession() {
  if (!state.running || state.paused) return;

  // Snapshot the exact elapsed time before the interval is cleared so repeated
  // pauses do not accumulate rounding loss.
  if (state.sessionStartTime !== null) {
    state.sessionElapsedSeconds = (Date.now() - state.sessionStartTime) / 1000;
    if (sessionElapsedEl) {
      sessionElapsedEl.textContent = formatTime(state.sessionElapsedSeconds);
    }
  }

  state.paused = true;
  stopAllIntervals();
  setStatus('Paused', '');
  setCountdownActive(false);
  updateStartPauseButton();
}

function resumeSession() {
  if (!state.running || !state.paused) return;

  state.paused = false;

  if (state.phase === 'countdown') {
    // The session clock has not started yet, so do not resume it here.
    setStatus('Preparing', 'status-ready');
    setCountdownActive(true);
    runCountdownInterval();
  } else {
    // Re-base the wall clock so paused time is not counted as elapsed.
    if (state.sessionStartTime !== null) {
      state.sessionStartTime = Date.now() - state.sessionElapsedSeconds * 1000;
      startSessionInterval();
    }

    if (state.phase === 'round') {
      setStatus('In Progress', 'status-running');
      resumePhaseTimer();
    } else if (state.phase === 'break') {
      setStatus('Rest', 'status-rest');
      resumePhaseTimer();
    } else {
      setStatus('Ready', 'status-idle');
    }
  }

  updateStartPauseButton();
}

function endSession(reason) {
  const wasRunning = state.running;

  state.running = false;
  state.paused = false;
  state.phase = 'done';
  state.timeRemaining = 0;

  stopAllIntervals();
  setCountdownActive(false);
  if (timeDisplayEl) timeDisplayEl.textContent = '00:00';
  setStatus(reason || 'Session complete', 'status-complete');
  if (phaseLabelEl) phaseLabelEl.textContent = 'DONE';
  if (nextInfoEl) nextInfoEl.textContent = '';

  if (wasRunning) playGong();
  updateStartPauseButton();
}

function resetToIdle() {
  stopAllIntervals();

  Object.assign(state, {
    running: false,
    paused: false,
    phase: 'idle',
    currentRound: 0,
    timeRemaining: 0,
    roundDuration: 0,
    breakDuration: 0,
    countdownRemaining: 0,
    sessionElapsedSeconds: 0,
    sessionStartTime: null
  });

  setCountdownActive(false);
  if (timeDisplayEl) timeDisplayEl.textContent = '00:00';
  setStatus('Ready', 'status-idle');
  if (phaseLabelEl) phaseLabelEl.textContent = 'GET READY';
  if (roundInfoEl) roundInfoEl.textContent = '- / -';
  if (sessionElapsedEl) sessionElapsedEl.textContent = '00:00';
  if (nextInfoEl) nextInfoEl.textContent = '';

  updateStartPauseButton();
}

function stopSession() {
  resetToIdle();
}

function handleStartPause() {
  initAudio();

  if (!state.running) {
    startSession();
  } else if (state.paused) {
    resumeSession();
  } else {
    pauseSession();
  }
}

/* --------------------------------------------------------------------------
 * Event wiring — every control is bound exactly once.
 * ------------------------------------------------------------------------ */

if (startPauseBtn) startPauseBtn.addEventListener('click', handleStartPause);
if (stopBtn) stopBtn.addEventListener('click', stopSession);

if (optionsBtn && optionsModal) {
  optionsBtn.addEventListener('click', () => {
    if (typeof optionsModal.showModal === 'function' && !optionsModal.open) {
      optionsModal.showModal();
    }
  });
}

function closeOptionsModal() {
  if (optionsModal && typeof optionsModal.close === 'function') {
    optionsModal.close();
  }
}

if (closeModalBtn) closeModalBtn.addEventListener('click', closeOptionsModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeOptionsModal);

[roundMinInput, roundMaxInput, breakMinInput, breakMaxInput].forEach((input) => {
  if (!input) return;
  input.addEventListener('input', updateRangeDisplays);
  input.addEventListener('change', updateRangeDisplays);
});

for (const radio of endConditionRadios) {
  radio.addEventListener('change', syncEndConditionInputs);
}

updateRangeDisplays();
syncEndConditionInputs();
updateStartPauseButton();
