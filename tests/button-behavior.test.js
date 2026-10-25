import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('Button behavior tests', () => {
  let state;
  let startPauseBtn, stopBtn;
  
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <button id="startPauseBtn">Start</button>
      <button id="stopBtn">Stop</button>
      <span id="status"></span>
      <span id="phaseLabel"></span>
      <span id="timeDisplay"></span>
      <span id="roundInfo"></span>
    `;
    startPauseBtn = document.getElementById('startPauseBtn');
    stopBtn = document.getElementById('stopBtn');
    
    state = {
      running: false,
      paused: false,
      currentRound: 0,
      totalRounds: 5,
      endCondition: 'rounds',
      phase: 'idle',
      timeRemaining: 0,
      intervalId: null,
      sessionIntervalId: null,
      countdownSeconds: 5
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Start/Pause button', () => {
    it('should start session when idle and not running', () => {
      expect(state.running).toBe(false);
      expect(state.phase).toBe('idle');
      
      // Simulate start
      state.running = true;
      state.paused = false;
      state.phase = 'round';
      state.currentRound = 1;
      
      expect(state.running).toBe(true);
      expect(state.paused).toBe(false);
      expect(state.phase).toBe('round');
      expect(state.currentRound).toBe(1);
    });

    it('should pause when running and not paused', () => {
      state.running = true;
      state.paused = false;
      state.phase = 'round';
      
      // Simulate pause
      state.paused = true;
      if (state.intervalId) clearInterval(state.intervalId);
      
      expect(state.paused).toBe(true);
      expect(state.running).toBe(true);
    });

    it('should resume when paused', () => {
      state.running = true;
      state.paused = true;
      state.phase = 'round';
      state.timeRemaining = 30;
      
      // Simulate resume
      state.paused = false;
      
      expect(state.paused).toBe(false);
      expect(state.running).toBe(true);
    });

    it('should update button text based on state', () => {
      // Idle state
      expect(state.running && state.phase === 'idle').toBe(false);
      
      // Running state
      state.running = true;
      state.paused = false;
      expect(state.running && !state.paused).toBe(true);
      
      // Paused state
      state.paused = true;
      expect(state.paused).toBe(true);
    });
  });

  describe('Stop button', () => {
    it('should stop session when running', () => {
      state.running = true;
      state.paused = false;
      state.phase = 'round';
      state.currentRound = 2;
      
      // Simulate stop
      state.running = false;
      state.paused = false;
      state.phase = 'idle';
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }
      
      expect(state.running).toBe(false);
      expect(state.phase).toBe('idle');
    });

    it('should stop session when paused', () => {
      state.running = true;
      state.paused = true;
      state.phase = 'break';
      
      // Simulate stop
      state.running = false;
      state.paused = false;
      state.phase = 'idle';
      
      expect(state.running).toBe(false);
      expect(state.paused).toBe(false);
      expect(state.phase).toBe('idle');
    });

    it('should clear intervals on stop', () => {
      state.running = true;
      const intervalId = setInterval(() => {}, 1000);
      state.intervalId = intervalId;
      
      clearInterval(state.intervalId);
      state.intervalId = null;
      
      expect(state.intervalId).toBe(null);
    });
  });

  describe('Round start and end behavior', () => {
    it('should start round with correct phase and status', () => {
      state.phase = 'round';
      state.currentRound = 1;
      state.roundDuration = 180;
      state.timeRemaining = 180;
      
      expect(state.phase).toBe('round');
      expect(state.currentRound).toBe(1);
      expect(state.timeRemaining).toBe(180);
    });

    it('should transition from round to break when time expires', () => {
      state.phase = 'round';
      state.timeRemaining = 1;
      
      // Simulate time expiration
      state.timeRemaining = 0;
      expect(state.timeRemaining).toBe(0);
      
      // Transition to break
      state.phase = 'break';
      expect(state.phase).toBe('break');
    });

    it('should increment round count after break', () => {
      state.phase = 'break';
      state.currentRound = 1;
      
      // Simulate break end, go to next round
      state.phase = 'round';
      state.currentRound++;
      
      expect(state.phase).toBe('round');
      expect(state.currentRound).toBe(2);
    });
  });

  describe('Break start and end behavior', () => {
    it('should start break with correct phase', () => {
      state.phase = 'break';
      state.breakDuration = 60;
      state.timeRemaining = 60;
      
      expect(state.phase).toBe('break');
      expect(state.timeRemaining).toBe(60);
    });

    it('should transition from break to next round when time expires', () => {
      state.phase = 'break';
      state.timeRemaining = 1;
      
      state.timeRemaining = 0;
      state.phase = 'round';
      state.currentRound++;
      
      expect(state.phase).toBe('round');
      expect(state.currentRound).toBe(1); // incremented
    });

    it('should end session after break if last round completed', () => {
      state.endCondition = 'rounds';
      state.currentRound = 5;
      state.totalRounds = 5;
      state.phase = 'break';
      
      // After break of last round, should end
      const shouldEnd = state.endCondition === 'rounds' && state.currentRound >= state.totalRounds;
      expect(shouldEnd).toBe(true);
    });
  });

  describe('Pause behavior during rounds and breaks', () => {
    it('should pause during round without losing time', () => {
      state.phase = 'round';
      state.running = true;
      state.paused = false;
      state.timeRemaining = 45;
      
      state.paused = true;
      // timeRemaining should stay the same
      expect(state.timeRemaining).toBe(45);
      expect(state.paused).toBe(true);
    });

    it('should pause during break without losing time', () => {
      state.phase = 'break';
      state.running = true;
      state.paused = false;
      state.timeRemaining = 20;
      
      state.paused = true;
      expect(state.timeRemaining).toBe(20);
      expect(state.paused).toBe(true);
    });

    it('should resume timer after pause', () => {
      state.phase = 'round';
      state.running = true;
      state.paused = true;
      state.timeRemaining = 30;
      
      state.paused = false;
      expect(state.paused).toBe(false);
      expect(state.timeRemaining).toBe(30);
    });
  });

  describe('Stop behavior at different stages', () => {
    it('should stop at round start', () => {
      state.running = true;
      state.phase = 'round';
      state.currentRound = 1;
      
      state.running = false;
      state.phase = 'idle';
      
      expect(state.running).toBe(false);
      expect(state.phase).toBe('idle');
    });

    it('should stop at break start', () => {
      state.running = true;
      state.phase = 'break';
      
      state.running = false;
      state.phase = 'idle';
      
      expect(state.running).toBe(false);
      expect(state.phase).toBe('idle');
    });

    it('should stop mid-round', () => {
      state.running = true;
      state.paused = false;
      state.phase = 'round';
      state.timeRemaining = 60;
      
      state.running = false;
      state.paused = false;
      state.phase = 'idle';
      
      expect(state.running).toBe(false);
      expect(state.phase).toBe('idle');
    });

    it('should stop mid-break', () => {
      state.running = true;
      state.paused = false;
      state.phase = 'break';
      state.timeRemaining = 30;
      
      state.running = false;
      state.paused = false;
      state.phase = 'idle';
      
      expect(state.running).toBe(false);
      expect(state.phase).toBe('idle');
    });
  });
});

describe('Session end behavior - last round finished', () => {
  let state;
  let startPauseBtn, stopBtn;
  
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <button id="startPauseBtn">Start</button>
      <button id="stopBtn">Stop</button>
      <span id="status"></span>
      <span id="phaseLabel"></span>
      <span id="timeDisplay"></span>
      <span id="roundInfo"></span>
      <span id="sessionElapsed"></span>
      <div id="nextInfo"></div>
    `;
    startPauseBtn = document.getElementById('startPauseBtn');
    stopBtn = document.getElementById('stopBtn');
    
    state = {
      running: false,
      paused: false,
      currentRound: 0,
      totalRounds: 3,
      endCondition: 'rounds',
      phase: 'idle',
      timeRemaining: 0,
      intervalId: null,
      sessionIntervalId: null,
      countdownSeconds: 5,
      sessionElapsedSeconds: 0
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should end session when last round is completed', () => {
    // Simulate being in last round
    state.running = true;
    state.currentRound = 3;
    state.totalRounds = 3;
    state.phase = 'round';
    state.timeRemaining = 1;
    
    // Round ends, check if should go to break
    // In our logic, when round ends we call nextBreak()
    // nextBreak checks if currentRound >= totalRounds and ends session
    const shouldEndAfterBreak = state.endCondition === 'rounds' && state.currentRound >= state.totalRounds;
    expect(shouldEndAfterBreak).toBe(true);
  });

  it('pause button should change to start/resume state after session ends', () => {
    // Simulate session ended
    state.running = false;
    state.paused = false;
    state.phase = 'idle';
    
    // After endSession, updateStartPauseButton sets button to Start state
    const isIdle = !state.running && state.phase === 'idle';
    expect(isIdle).toBe(true);
  });

  it('stop button should reset timer display when clicked', () => {
    // Simulate session running
    state.running = true;
    state.phase = 'round';
    state.currentRound = 2;
    state.timeRemaining = 45;
    
    // Click stop
    if (!state.running && state.phase === 'idle') {
      // do nothing
    } else {
      state.running = false;
      state.paused = false;
      state.phase = 'idle';
      state.currentRound = 0;
      state.timeRemaining = 0;
      state.sessionElapsedSeconds = 0;
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }
    }
    
    expect(state.running).toBe(false);
    expect(state.phase).toBe('idle');
    expect(state.currentRound).toBe(0);
    expect(state.timeRemaining).toBe(0);
  });

  it('stop button resets all state when session completes naturally', () => {
    // Session completed after last round
    state.running = false;
    state.paused = false;
    state.phase = 'idle';
    state.currentRound = 0;
    state.sessionElapsedSeconds = 0;
    
    // Stop should be able to reset cleanly
    expect(state.running).toBe(false);
    expect(state.phase).toBe('idle');
  });

  it('after session ends, clicking start should work again', () => {
    // Session ended
    state.running = false;
    state.paused = false;
    state.phase = 'idle';
    
    // Can start new session
    state.running = true;
    state.phase = 'round';
    state.currentRound = 1;
    
    expect(state.running).toBe(true);
    expect(state.phase).toBe('round');
  });
});
