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
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// UI elements
const setupSection = document.getElementById('setup');
const timerSection = document.getElementById('timer');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

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

const statusEl = document.getElementById('status');
const roundInfoEl = document.getElementById('roundInfo');
const sessionElapsedEl = document.getElementById('sessionElapsed');
const phaseLabelEl = document.getElementById('phaseLabel');
const timeDisplayEl = document.getElementById('timeDisplay');
const nextInfoEl = document.getElementById('nextInfo');

// State
let state = {
  running: false,
  currentRound: 0,
  totalRounds: 0,
  endCondition: 'rounds',
  targetSessionMinutes: 0,
  sessionStartTime: null,
  sessionElapsedSeconds: 0,
  phase: 'idle', // countdown, round, break, done
  timeRemaining: 0,
  roundDuration: 0,
  breakDuration: 0,
  countdownSeconds: 5,
  intervalId: null,
  sessionIntervalId: null
};

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

startBtn.addEventListener('click', startSession);
stopBtn.addEventListener('click', stopSession);

function startSession() {
  initAudio(); // Ensure audio context is ready (user gesture)
  
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
  state.currentRound = 0;
  state.sessionStartTime = Date.now();
  state.sessionElapsedSeconds = 0;
  
  setupSection.classList.add('hidden');
  timerSection.classList.remove('hidden');
  
  // Start session elapsed timer
  if (state.sessionIntervalId) clearInterval(state.sessionIntervalId);
  state.sessionIntervalId = setInterval(updateSessionElapsed, 1000);
  
  // Start first round
  nextRound();
}

function updateSessionElapsed() {
  if (!state.running) return;
  state.sessionElapsedSeconds = Math.floor((Date.now() - state.sessionStartTime) / 1000);
  sessionElapsedEl.textContent = formatTime(state.sessionElapsedSeconds);
  
  // Check if time-based end condition reached
  if (state.endCondition === 'time') {
    if (state.sessionElapsedSeconds >= state.targetSessionMinutes * 60) {
      endSession('Time limit reached');
    }
  }
}

function nextRound() {
  state.currentRound++;
  
  if (state.endCondition === 'rounds' && state.currentRound > state.totalRounds) {
    endSession('All rounds completed');
    return;
  }
  
  // Generate random round duration
  state.roundDuration = randomInRange(
    parseInt(roundMinInput.value),
    parseInt(roundMaxInput.value)
  );
  
  // Start countdown before round
  startCountdown('ROUND', state.roundDuration, () => {
    startRound();
  }, `Next: Round ${state.currentRound}`);
}

function startRound() {
  state.phase = 'round';
  statusEl.textContent = 'IN PROGRESS';
  roundInfoEl.textContent = `${state.currentRound} / ${state.endCondition === 'rounds' ? state.totalRounds : '∞'}`;
  phaseLabelEl.textContent = `ROUND ${state.currentRound}`;
  
  playGong(); // Gong to start round
  
  state.timeRemaining = state.roundDuration;
  timeDisplayEl.textContent = formatTime(state.timeRemaining);
  
  if (state.intervalId) clearInterval(state.intervalId);
  state.intervalId = setInterval(() => {
    state.timeRemaining--;
    timeDisplayEl.textContent = formatTime(state.timeRemaining);
    
    if (state.timeRemaining <= 0) {
      clearInterval(state.intervalId);
      playGong(); // Gong to end round
      nextBreak();
    }
  }, 1000);
}

function nextBreak() {
  // Generate random break duration
  state.breakDuration = randomInRange(
    parseInt(breakMinInput.value),
    parseInt(breakMaxInput.value)
  );
  
  // Check if we should do a break or end
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
  
  // Start countdown before break
  startCountdown('BREAK', state.breakDuration, () => {
    startBreak();
  }, `After break: Round ${state.currentRound + 1}`);
}

function startBreak() {
  state.phase = 'break';
  statusEl.textContent = 'REST';
  phaseLabelEl.textContent = 'BREAK';
  
  playGong(); // Gong to start break
  
  state.timeRemaining = state.breakDuration;
  timeDisplayEl.textContent = formatTime(state.timeRemaining);
  
  if (state.intervalId) clearInterval(state.intervalId);
  state.intervalId = setInterval(() => {
    state.timeRemaining--;
    timeDisplayEl.textContent = formatTime(state.timeRemaining);
    
    if (state.timeRemaining <= 0) {
      clearInterval(state.intervalId);
      playGong(); // Gong to end break
      nextRound();
    }
  }, 1000);
}

function startCountdown(phaseName, nextDuration, callback, nextInfoText) {
  state.phase = 'countdown';
  statusEl.textContent = 'GET READY';
  phaseLabelEl.textContent = `NEXT: ${phaseName}`;
  nextInfoEl.textContent = nextInfoText || '';
  
  let count = state.countdownSeconds;
  state.timeRemaining = count;
  timeDisplayEl.textContent = formatTime(count);
  
  if (state.intervalId) clearInterval(state.intervalId);
  
  // Play beep for each second of countdown
  if (count > 0) {
    playBeep();
  }
  
  state.intervalId = setInterval(() => {
    count--;
    state.timeRemaining = count;
    timeDisplayEl.textContent = formatTime(count);
    
    if (count > 0) {
      playBeep();
    } else if (count === 0) {
      playBeep(); // Last beep
    }
    
    if (count <= 0) {
      clearInterval(state.intervalId);
      callback();
    }
  }, 1000);
}

function stopSession() {
  if (!state.running) return;
  if (confirm('Stop and cancel the current training session?')) {
    endSession('Session cancelled by user');
  }
}

function endSession(reason) {
  state.running = false;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  if (state.sessionIntervalId) {
    clearInterval(state.sessionIntervalId);
    state.sessionIntervalId = null;
  }
  
  statusEl.textContent = 'COMPLETE';
  phaseLabelEl.textContent = reason.toUpperCase();
  timeDisplayEl.textContent = '00:00';
  nextInfoEl.textContent = '';
  
  // Show alert
  setTimeout(() => {
    alert(reason);
  }, 100);
}
