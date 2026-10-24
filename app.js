// Web Audio API for sounds
let audioContext = null;

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

// Gong sound (lower frequency, longer decay) for round/break start and end
function playGong() {
  initAudio();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(80, audioContext.currentTime + 0.8);
  
  gainNode.gain.setValueAtTime(0.8, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.2);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 1.2);
}

// Beep sound (higher frequency, short) for countdown
function playBeep() {
  initAudio();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.2);
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// UI elements
const optionsBtn = document.getElementById('optionsBtn');
const optionsModal = document.getElementById('optionsModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModalBtn');

const roundMinInput = document.getElementById('roundMin');
const roundMaxInput = document.getElementById('roundMax');
const breakMinInput = document.getElementById('breakMin');
const breakMaxInput = document.getElementById('breakMax');
const endConditionRadios = document.getElementsByName('endCondition');
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

// State
let state = {
  running: false,
  paused: false,
  currentRound: 0,
  totalRounds: 0,
  endCondition: 'rounds',
  targetSessionMinutes: 0,
  sessionStartTime: null,
  sessionElapsedSeconds: 0,
  phase: 'idle', // idle, countdown, round, break, done
  timeRemaining: 0,
  roundDuration: 0,
  breakDuration: 0,
  countdownSeconds: 5,
  intervalId: null,
  sessionIntervalId: null,
  nextAction: null // function to call when resuming
};

function updateRangeDisplays() {
  roundRangeDisplay.textContent = `${roundMinInput.value}s - ${roundMaxInput.value}s`;
  breakRangeDisplay.textContent = `${breakMinInput.value}s - ${breakMaxInput.value}s`;
}

[roundMinInput, roundMaxInput, breakMinInput, breakMaxInput].forEach(input => {
  input.addEventListener('change', updateRangeDisplays);
});

updateRangeDisplays();

endConditionRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'rounds') {
      roundsInput.classList.remove('hidden');
      timeInput.classList.add('hidden');
    } else {
      roundsInput.classList.add('hidden');
      timeInput.classList.remove('hidden');
    }
  });
});

// Modal
optionsBtn.addEventListener('click', () => {
  optionsModal.showModal();
});

closeModalBtn.addEventListener('click', () => {
  optionsModal.close();
});

modalBackdrop.addEventListener('click', () => {
  optionsModal.close();
});

// Start/Pause button
startPauseBtn.addEventListener('click', handleStartPause);
stopBtn.addEventListener('click', stopSession);

function handleStartPause() {
  initAudio();
  
  if (!state.running && state.phase === 'idle') {
    startSession();
  } else if (state.running && !state.paused) {
    pauseSession();
  } else if (state.paused) {
    resumeSession();
  }
}

function startSession() {
  const roundMin = parseInt(roundMinInput.value);
  const roundMax = parseInt(roundMaxInput.value);
  const breakMin = parseInt(breakMinInput.value);
  const breakMax = parseInt(breakMaxInput.value);
  
  if (roundMin > roundMax || breakMin > breakMax) {
    alert('Min time cannot be greater than max time');
    return;
  }
  
  // Get end condition
  let endCondition = 'rounds';
  for (const radio of endConditionRadios) {
    if (radio.checked) {
      endCondition = radio.value;
      break;
    }
  }
  
  state.endCondition = endCondition;
  state.totalRounds = parseInt(roundCountInput.value);
  state.targetSessionMinutes = parseInt(sessionMinutesInput.value);
  state.countdownSeconds = parseInt(countdownInput.value) || 5;
  
  state.running = true;
  state.paused = false;
  state.currentRound = 0;
  state.sessionStartTime = Date.now();
  state.sessionElapsedSeconds = 0;
  state.phase = 'idle';
  
  timeDisplayEl.classList.remove('countdown-active');
  
  updateStartPauseButton();
  
  // Start session elapsed timer
  if (state.sessionIntervalId) clearInterval(state.sessionIntervalId);
  state.sessionIntervalId = setInterval(updateSessionElapsed, 1000);
  
  timeDisplayEl.classList.remove('countdown-active');
  nextInfoEl.textContent = '';
  phaseLabelEl.textContent = 'ROUND 1';
  
  // Start first round directly
  state.currentRound = 1;
  if (state.endCondition === 'rounds' && state.currentRound > state.totalRounds) {
    endSession('All rounds completed');
    return;
  }
  
  state.roundDuration = randomInRange(
    parseInt(roundMinInput.value),
    parseInt(roundMaxInput.value)
  );
  
  startRound();
}

function pauseSession() {
  state.paused = true;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  if (state.sessionIntervalId) {
    clearInterval(state.sessionIntervalId);
    state.sessionIntervalId = null;
  }
  statusEl.textContent = 'Paused';
  statusEl.className = 'meta-value';
  timeDisplayEl.classList.remove('countdown-active');
  updateStartPauseButton();
}

function resumeSession() {
  state.paused = false;
  statusEl.textContent = state.phase === 'round' ? 'In Progress' : state.phase === 'break' ? 'Rest' : 'Ready';
  if (state.phase === 'round') statusEl.className = 'meta-value status-running';
  else if (state.phase === 'break') statusEl.className = 'meta-value status-rest';
  else statusEl.className = 'meta-value';
  
  // Resume session elapsed timer
  if (state.sessionIntervalId) clearInterval(state.sessionIntervalId);
  state.sessionStartTime = Date.now() - (state.sessionElapsedSeconds * 1000);
  state.sessionIntervalId = setInterval(updateSessionElapsed, 1000);
  
  if (state.phase === 'round' || state.phase === 'break') {
    resumeTimer();
  }
  
  updateStartPauseButton();
}

function resumeCountdown() {
  let count = state.timeRemaining;
  if (state.intervalId) clearInterval(state.intervalId);
  
  if (count > 0 && count <= 5) {
    timeDisplayEl.classList.add('countdown-active');
  } else {
    timeDisplayEl.classList.remove('countdown-active');
  }
  
  state.intervalId = setInterval(() => {
    count--;
    state.timeRemaining = count;
    timeDisplayEl.textContent = formatTime(count);
    
    if (count > 0 && count <= 5) {
      timeDisplayEl.classList.add('countdown-active');
      playBeep();
    } else if (count > 5) {
      timeDisplayEl.classList.remove('countdown-active');
      playBeep();
    } else if (count === 0) {
      timeDisplayEl.classList.add('countdown-active');
      playBeep();
    }
    
    if (count <= 0) {
      clearInterval(state.intervalId);
      timeDisplayEl.classList.remove('countdown-active');
      state.nextAction();
      state.nextAction = null;
    }
  }, 1000);
}

function resumeTimer() {
  if (state.intervalId) clearInterval(state.intervalId);
  
  if (state.timeRemaining > 0 && state.timeRemaining <= 5) {
    timeDisplayEl.classList.add('countdown-active');
  } else {
    timeDisplayEl.classList.remove('countdown-active');
  }
  
  state.intervalId = setInterval(() => {
    state.timeRemaining--;
    timeDisplayEl.textContent = formatTime(state.timeRemaining);
    
    if (state.timeRemaining > 0 && state.timeRemaining <= 5) {
      timeDisplayEl.classList.add('countdown-active');
      playBeep();
    } else if (state.timeRemaining > 5) {
      timeDisplayEl.classList.remove('countdown-active');
    }
    
    if (state.timeRemaining <= 0) {
      clearInterval(state.intervalId);
      timeDisplayEl.classList.remove('countdown-active');
      if (state.phase === 'round') {
        playGong();
        nextBreak();
      } else if (state.phase === 'break') {
        playGong();
        nextRound();
      }
    }
  }, 1000);
}

function updateStartPauseButton() {
  if (!state.running && state.phase === 'idle') {
    startPauseBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,3 19,12 5,21"></polygon>
      </svg>
      Start
    `;
    startPauseBtn.className = 'btn btn-start';
    startPauseBtn.disabled = false;
  } else if (state.running && !state.paused) {
    startPauseBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
      Pause
    `;
    startPauseBtn.className = 'btn btn-pause';
    startPauseBtn.disabled = false;
  } else if (state.paused) {
    startPauseBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,3 19,12 5,21"></polygon>
      </svg>
      Resume
    `;
    startPauseBtn.className = 'btn btn-start';
    startPauseBtn.disabled = false;
  }
}

function updateSessionElapsed() {
  if (!state.running || state.paused) return;
  state.sessionElapsedSeconds = Math.floor((Date.now() - state.sessionStartTime) / 1000);
  sessionElapsedEl.textContent = formatTime(state.sessionElapsedSeconds);
  
  if (state.endCondition === 'time') {
    if (state.sessionElapsedSeconds >= state.targetSessionMinutes * 60) {
      endSession('Time limit reached');
    }
  }
}

function nextRound() {
  if (!state.running) return;
  state.currentRound++;
  
  if (state.endCondition === 'rounds' && state.currentRound > state.totalRounds) {
    endSession('All rounds completed');
    return;
  }
  
  state.roundDuration = randomInRange(
    parseInt(roundMinInput.value),
    parseInt(roundMaxInput.value)
  );
  
  startRound();
}

function startRound() {
  state.phase = 'round';
  statusEl.textContent = 'In Progress';
  statusEl.className = 'meta-value status-running';
  roundInfoEl.textContent = `${state.currentRound} / ${state.endCondition === 'rounds' ? state.totalRounds : '∞'}`;
  phaseLabelEl.textContent = `ROUND ${state.currentRound}`;
  timeDisplayEl.classList.remove('countdown-active');
  
  playGong();
  
  state.timeRemaining = state.roundDuration;
  timeDisplayEl.textContent = formatTime(state.timeRemaining);
  
  if (state.intervalId) clearInterval(state.intervalId);
  state.intervalId = setInterval(() => {
    if (state.paused) return;
    state.timeRemaining--;
    timeDisplayEl.textContent = formatTime(state.timeRemaining);
    
    // Beep in last 5 seconds
    if (state.timeRemaining > 0 && state.timeRemaining <= 5) {
      timeDisplayEl.classList.add('countdown-active');
      playBeep();
    } else if (state.timeRemaining > 5) {
      timeDisplayEl.classList.remove('countdown-active');
    }
    
    if (state.timeRemaining <= 0) {
      clearInterval(state.intervalId);
      timeDisplayEl.classList.remove('countdown-active');
      playGong();
      nextBreak();
    }
  }, 1000);
}

function nextBreak() {
  if (!state.running) return;
  
  state.breakDuration = randomInRange(
    parseInt(breakMinInput.value),
    parseInt(breakMaxInput.value)
  );
  
  if (state.endCondition === 'rounds' && state.currentRound >= state.totalRounds) {
    endSession('Session complete');
    return;
  }
  
  if (state.endCondition === 'time') {
    const projectedTime = state.sessionElapsedSeconds + state.breakDuration;
    if (projectedTime >= state.targetSessionMinutes * 60) {
      endSession('Time limit reached');
      return;
    }
  }
  
  startBreak();
}

function startBreak() {
  state.phase = 'break';
  statusEl.textContent = 'Rest';
  statusEl.className = 'meta-value status-rest';
  phaseLabelEl.textContent = 'BREAK';
  timeDisplayEl.classList.remove('countdown-active');
  
  playGong();
  
  state.timeRemaining = state.breakDuration;
  timeDisplayEl.textContent = formatTime(state.timeRemaining);
  
  if (state.intervalId) clearInterval(state.intervalId);
  state.intervalId = setInterval(() => {
    if (state.paused) return;
    state.timeRemaining--;
    timeDisplayEl.textContent = formatTime(state.timeRemaining);
    
    if (state.timeRemaining > 0 && state.timeRemaining <= 5) {
      timeDisplayEl.classList.add('countdown-active');
      playBeep();
    } else if (state.timeRemaining > 5) {
      timeDisplayEl.classList.remove('countdown-active');
    }
    
    if (state.timeRemaining <= 0) {
      clearInterval(state.intervalId);
      timeDisplayEl.classList.remove('countdown-active');
      playGong();
      nextRound();
    }
  }, 1000);
}

