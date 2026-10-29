import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// These tests load the real index.html and execute the real src/app.js in jsdom,
// then drive the UI with fake timers. Unlike the other test files, nothing here
// re-implements the app logic, so a broken handler actually fails a test.

const htmlSource = fs.readFileSync(path.resolve(__dirname, '../src/index.html'), 'utf8');
const appSource = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');

function loadApp() {
  const body = htmlSource.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1];
  // innerHTML does not execute scripts, but strip them to be explicit.
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gi, '');

  // jsdom does not implement dialog methods; provide minimal stand-ins.
  const dialog = document.getElementById('optionsModal');
  dialog.showModal = vi.fn(function () {
    this.open = true;
  });
  dialog.close = vi.fn(function () {
    this.open = false;
  });

  window.alert = vi.fn();
  window.AudioContext = vi.fn(function () {
    return {
      createOscillator: vi.fn(() => ({
        connect: vi.fn(),
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        },
        start: vi.fn(),
        stop: vi.fn()
      })),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn()
        }
      })),
      destination: {},
      currentTime: 0,
      state: 'running',
      resume: vi.fn()
    };
  });
  window.webkitAudioContext = window.AudioContext;

  new Function(appSource).call(window);

  return { dialog };
}

function $(id) {
  return document.getElementById(id);
}

function click(id) {
  $(id).click();
}

function setInputs(values) {
  for (const [id, value] of Object.entries(values)) {
    $(id).value = String(value);
  }
}

function text(id) {
  return $(id).textContent.trim();
}

describe('integration: real app.js driven through index.html', () => {
  let dialog;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    ({ dialog } = loadApp());
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders the idle state on load', () => {
    expect(text('startPauseBtn')).toContain('Start');
    expect(text('timeDisplay')).toBe('00:00');
    expect(text('status')).toBe('Ready');
    expect(text('phaseLabel')).toBe('GET READY');
    expect(text('roundInfo')).toBe('- / -');

    // Values rendered by app.js at load (not present in the HTML).
    expect(text('roundRangeDisplay')).toBe('180s - 300s');
    expect(text('breakRangeDisplay')).toBe('60s - 90s');
  });

  describe('Start / Pause / Resume button', () => {
    it('starts a round with a single click (no accidental pause)', () => {
      setInputs({
        countdown: 0,
        roundMin: 60,
        roundMax: 60,
        breakMin: 30,
        breakMax: 30,
        roundCount: 2
      });

      click('startPauseBtn');

      // A duplicated click handler would start and then immediately pause.
      expect(text('status')).toBe('In Progress');
      expect(text('phaseLabel')).toBe('ROUND 1');
      expect(text('roundInfo')).toBe('1 / 2');
      expect(text('timeDisplay')).toBe('01:00');
      expect(text('startPauseBtn')).toContain('Pause');

      vi.advanceTimersByTime(1000);
      expect(text('timeDisplay')).toBe('00:59');
      expect(text('sessionElapsed')).toBe('00:01');
    });

    it('pauses and resumes without losing time', () => {
      setInputs({
        countdown: 0,
        roundMin: 60,
        roundMax: 60,
        breakMin: 30,
        breakMax: 30,
        roundCount: 2
      });

      click('startPauseBtn');
      vi.advanceTimersByTime(1000);
      expect(text('timeDisplay')).toBe('00:59');

      click('startPauseBtn'); // pause
      expect(text('status')).toBe('Paused');
      expect(text('startPauseBtn')).toContain('Resume');
      expect(text('timeDisplay')).toBe('00:59');
      expect(text('sessionElapsed')).toBe('00:01');
      expect(vi.getTimerCount()).toBe(0); // both intervals cleared

      vi.advanceTimersByTime(10000);
      expect(text('timeDisplay')).toBe('00:59');
      expect(text('sessionElapsed')).toBe('00:01');
      expect(text('phaseLabel')).toBe('ROUND 1');

      click('startPauseBtn'); // resume
      expect(text('status')).toBe('In Progress');
      expect(text('startPauseBtn')).toContain('Pause');

      vi.advanceTimersByTime(1000);
      expect(text('timeDisplay')).toBe('00:58');
      expect(text('sessionElapsed')).toBe('00:02');
    });

    it('runs the pre-start countdown before round 1', () => {
      setInputs({
        countdown: 3,
        roundMin: 5,
        roundMax: 5,
        breakMin: 5,
        breakMax: 5,
        roundCount: 1
      });

      click('startPauseBtn');
      expect(text('status')).toBe('Preparing');
      expect(text('phaseLabel')).toBe('GET READY');
      expect(text('timeDisplay')).toBe('00:03');

      vi.advanceTimersByTime(1000);
      expect(text('timeDisplay')).toBe('00:02');

      vi.advanceTimersByTime(2000);
      expect(text('phaseLabel')).toBe('ROUND 1');
      expect(text('status')).toBe('In Progress');
      expect(text('timeDisplay')).toBe('00:05');
    });

    it('pauses and resumes the countdown', () => {
      setInputs({
        countdown: 5,
        roundMin: 10,
        roundMax: 10,
        breakMin: 5,
        breakMax: 5,
        roundCount: 1
      });

      click('startPauseBtn');
      vi.advanceTimersByTime(2000); // 3 left
      expect(text('timeDisplay')).toBe('00:03');

      click('startPauseBtn'); // pause
      vi.advanceTimersByTime(5000);
      expect(text('timeDisplay')).toBe('00:03');
      expect(text('status')).toBe('Paused');

      click('startPauseBtn'); // resume
      expect(text('status')).toBe('Preparing');
      vi.advanceTimersByTime(3000);
      expect(text('phaseLabel')).toBe('ROUND 1');
    });

    it('pauses and resumes during a break', () => {
      setInputs({
        countdown: 0,
        roundMin: 5,
        roundMax: 5,
        breakMin: 10,
        breakMax: 10,
        roundCount: 2
      });

      click('startPauseBtn');
      vi.advanceTimersByTime(5000); // round ends -> break
      expect(text('phaseLabel')).toBe('BREAK');
      expect(text('timeDisplay')).toBe('00:10');

      vi.advanceTimersByTime(2000);
      expect(text('timeDisplay')).toBe('00:08');

      click('startPauseBtn'); // pause during break
      expect(text('status')).toBe('Paused');
      expect(text('timeDisplay')).toBe('00:08');
      expect(vi.getTimerCount()).toBe(0);

      vi.advanceTimersByTime(5000);
      expect(text('timeDisplay')).toBe('00:08');

      click('startPauseBtn'); // resume break
      expect(text('status')).toBe('Rest');
      vi.advanceTimersByTime(1000);
      expect(text('timeDisplay')).toBe('00:07');

      vi.advanceTimersByTime(7000); // break ends -> round 2
      expect(text('phaseLabel')).toBe('ROUND 2');
      expect(text('roundInfo')).toBe('2 / 2');
      expect(text('timeDisplay')).toBe('00:05');
      expect(text('status')).toBe('In Progress');
    });
  });

  describe('Stop button', () => {
    it('resets everything when stopped mid-round', () => {
      setInputs({ countdown: 0, roundMin: 60, roundMax: 60, roundCount: 2 });

      click('startPauseBtn');
      vi.advanceTimersByTime(1000);
      click('stopBtn');

      expect(text('status')).toBe('Ready');
      expect(text('phaseLabel')).toBe('GET READY');
      expect(text('timeDisplay')).toBe('00:00');
      expect(text('sessionElapsed')).toBe('00:00');
      expect(text('roundInfo')).toBe('- / -');
      expect(text('startPauseBtn')).toContain('Start');

      // No interval may survive the stop.
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(5000);
      expect(text('timeDisplay')).toBe('00:00');
      expect(text('sessionElapsed')).toBe('00:00');
    });

    it('resets when stopped during the pre-start countdown', () => {
      setInputs({ countdown: 5, roundMin: 10, roundMax: 10, roundCount: 1 });

      click('startPauseBtn');
      vi.advanceTimersByTime(2000);
      click('stopBtn');

      expect(text('status')).toBe('Ready');
      expect(text('timeDisplay')).toBe('00:00');

      vi.advanceTimersByTime(10000);
      expect(text('timeDisplay')).toBe('00:00');
      expect(text('phaseLabel')).toBe('GET READY');
    });

    it('resets when stopped while paused', () => {
      setInputs({ countdown: 0, roundMin: 60, roundMax: 60, roundCount: 2 });

      click('startPauseBtn');
      vi.advanceTimersByTime(1000);
      click('startPauseBtn'); // pause
      click('stopBtn');

      expect(text('status')).toBe('Ready');
      expect(text('timeDisplay')).toBe('00:00');
      expect(text('startPauseBtn')).toContain('Start');

      vi.advanceTimersByTime(5000);
      expect(text('timeDisplay')).toBe('00:00');
    });

    it('resets when stopped during a break', () => {
      setInputs({
        countdown: 0,
        roundMin: 1,
        roundMax: 1,
        breakMin: 5,
        breakMax: 5,
        roundCount: 2
      });

      click('startPauseBtn');
      vi.advanceTimersByTime(1000); // round ends -> break
      expect(text('phaseLabel')).toBe('BREAK');

      click('stopBtn');
      expect(text('status')).toBe('Ready');
      expect(text('phaseLabel')).toBe('GET READY');
      expect(text('timeDisplay')).toBe('00:00');

      vi.advanceTimersByTime(5000);
      expect(text('timeDisplay')).toBe('00:00');
    });
  });

  describe('round and break transitions', () => {
    it('plays round -> break -> round and ends after the last round', () => {
      setInputs({
        countdown: 0,
        roundMin: 2,
        roundMax: 2,
        breakMin: 1,
        breakMax: 1,
        roundCount: 2
      });

      click('startPauseBtn');
      expect(text('phaseLabel')).toBe('ROUND 1');
      expect(text('roundInfo')).toBe('1 / 2');
      expect(text('timeDisplay')).toBe('00:02');

      vi.advanceTimersByTime(2000);
      expect(text('phaseLabel')).toBe('BREAK');
      expect(text('status')).toBe('Rest');
      expect(text('timeDisplay')).toBe('00:01');

      vi.advanceTimersByTime(1000);
      expect(text('phaseLabel')).toBe('ROUND 2');
      expect(text('roundInfo')).toBe('2 / 2');
      expect(text('timeDisplay')).toBe('00:02');

      // Last round ends: no trailing break, session completes.
      vi.advanceTimersByTime(2000);
      expect(text('phaseLabel')).toBe('DONE');
      expect(text('status')).toBe('Session complete');
      expect(text('startPauseBtn')).toContain('Start');
      expect(vi.getTimerCount()).toBe(0);

      vi.advanceTimersByTime(10000);
      expect(text('phaseLabel')).toBe('DONE');
    });

    it('can start a fresh session after one completes', () => {
      setInputs({
        countdown: 0,
        roundMin: 1,
        roundMax: 1,
        breakMin: 1,
        breakMax: 1,
        roundCount: 1
      });

      click('startPauseBtn');
      vi.advanceTimersByTime(1000);
      expect(text('phaseLabel')).toBe('DONE');

      click('startPauseBtn');
      expect(text('phaseLabel')).toBe('ROUND 1');
      expect(text('status')).toBe('In Progress');
      expect(text('roundInfo')).toBe('1 / 1');
      expect(text('sessionElapsed')).toBe('00:00');
    });
  });

  describe('time-based sessions', () => {
    function selectTimeCondition() {
      const timeRadio = document.querySelector('input[name="endCondition"][value="time"]');
      timeRadio.checked = true;
      timeRadio.dispatchEvent(new Event('change'));
    }

    it('does not count the pre-start countdown as session time', () => {
      selectTimeCondition();
      setInputs({
        countdown: 3,
        sessionMinutes: 1,
        roundMin: 10,
        roundMax: 10,
        breakMin: 5,
        breakMax: 5
      });

      click('startPauseBtn');
      expect(text('status')).toBe('Preparing');
      expect(text('sessionElapsed')).toBe('00:00');

      vi.advanceTimersByTime(2000);
      expect(text('timeDisplay')).toBe('00:01');
      expect(text('sessionElapsed')).toBe('00:00');

      vi.advanceTimersByTime(1000); // countdown ends, round 1 starts
      expect(text('phaseLabel')).toBe('ROUND 1');
      expect(text('sessionElapsed')).toBe('00:00');

      vi.advanceTimersByTime(1000); // one second of actual session time
      expect(text('sessionElapsed')).toBe('00:01');
    });

    it('allows a break that ends exactly on the time limit', () => {
      selectTimeCondition();
      setInputs({
        countdown: 0,
        sessionMinutes: 1,
        roundMin: 10,
        roundMax: 10,
        breakMin: 5,
        breakMax: 5
      });

      click('startPauseBtn');

      // 4 rounds of 10s + 3 completed breaks of 5s = 55s; the last break
      // would end exactly at the 60s limit, so it must still run.
      vi.advanceTimersByTime(55000);
      expect(text('phaseLabel')).toBe('BREAK');
      expect(text('timeDisplay')).toBe('00:05');

      vi.advanceTimersByTime(5000);
      expect(text('phaseLabel')).toBe('DONE');
      expect(text('status')).toBe('Time limit reached');
      expect(text('timeDisplay')).toBe('00:00');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('ends mid-round at the time limit and resets the display', () => {
      selectTimeCondition();
      setInputs({
        countdown: 0,
        sessionMinutes: 1,
        roundMin: 60,
        roundMax: 60,
        breakMin: 5,
        breakMax: 5
      });

      click('startPauseBtn');
      expect(text('timeDisplay')).toBe('01:00');

      vi.advanceTimersByTime(60000);
      expect(text('phaseLabel')).toBe('DONE');
      expect(text('status')).toBe('Time limit reached');
      expect(text('timeDisplay')).toBe('00:00');
      expect(text('startPauseBtn')).toContain('Start');
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('options modal', () => {
    it('opens via Settings, closes via the close button and the backdrop', () => {
      expect(dialog.showModal).not.toHaveBeenCalled();

      click('optionsBtn');
      expect(dialog.showModal).toHaveBeenCalledTimes(1);
      expect(dialog.open).toBe(true);

      click('closeModalBtn');
      expect(dialog.close).toHaveBeenCalledTimes(1);
      expect(dialog.open).toBe(false);

      click('optionsBtn');
      click('modalBackdrop');
      expect(dialog.close).toHaveBeenCalledTimes(2);
      expect(dialog.open).toBe(false);
    });

    it('toggles rounds/time inputs when the end condition changes', () => {
      // Default: rounds -> rounds input visible, time input hidden.
      expect($('roundsInput').classList.contains('hidden')).toBe(false);
      expect($('timeInput').classList.contains('hidden')).toBe(true);

      const timeRadio = document.querySelector('input[name="endCondition"][value="time"]');
      timeRadio.checked = true;
      timeRadio.dispatchEvent(new Event('change'));

      expect($('roundsInput').classList.contains('hidden')).toBe(true);
      expect($('timeInput').classList.contains('hidden')).toBe(false);

      const roundsRadio = document.querySelector('input[name="endCondition"][value="rounds"]');
      roundsRadio.checked = true;
      roundsRadio.dispatchEvent(new Event('change'));

      expect($('roundsInput').classList.contains('hidden')).toBe(false);
      expect($('timeInput').classList.contains('hidden')).toBe(true);
    });
  });

  describe('validation', () => {
    it('rejects min > max and does not start', () => {
      setInputs({
        countdown: 0,
        roundMin: 300,
        roundMax: 180,
        breakMin: 60,
        breakMax: 90,
        roundCount: 5
      });

      click('startPauseBtn');

      expect(window.alert).toHaveBeenCalledWith('Min time cannot be greater than max time');
      expect(text('phaseLabel')).toBe('GET READY');
      expect(text('startPauseBtn')).toContain('Start');

      vi.advanceTimersByTime(3000);
      expect(text('timeDisplay')).toBe('00:00');
    });

    it('starts once the ranges are valid', () => {
      setInputs({
        countdown: 0,
        roundMin: 180,
        roundMax: 300,
        breakMin: 60,
        breakMax: 90,
        roundCount: 5
      });

      click('startPauseBtn');

      expect(window.alert).not.toHaveBeenCalled();
      expect(text('phaseLabel')).toBe('ROUND 1');
      expect(text('startPauseBtn')).toContain('Pause');
    });

    it('rejects a missing round count', () => {
      setInputs({
        countdown: 0,
        roundMin: 180,
        roundMax: 300,
        breakMin: 60,
        breakMax: 90,
        roundCount: ''
      });

      click('startPauseBtn');

      expect(window.alert).toHaveBeenCalledWith('Number of rounds must be at least 1');
      expect(text('phaseLabel')).toBe('GET READY');
      expect(text('startPauseBtn')).toContain('Start');
    });

    it('falls back to the default 5-second countdown when the field is empty', () => {
      setInputs({
        countdown: '',
        roundMin: 10,
        roundMax: 10,
        breakMin: 5,
        breakMax: 5,
        roundCount: 1
      });

      click('startPauseBtn');
      // Empty countdown falls back to the documented default of 5 seconds.
      expect(text('status')).toBe('Preparing');
      expect(text('timeDisplay')).toBe('00:05');
    });
  });

  describe('audio cues', () => {
    it('plays a long beep on round start and beeps in the last five seconds', () => {
      setInputs({
        countdown: 0,
        roundMin: 7,
        roundMax: 7,
        breakMin: 5,
        breakMax: 5,
        roundCount: 1
      });

      expect(window.AudioContext).not.toHaveBeenCalled();
      click('startPauseBtn');
      const ctx = window.AudioContext.mock.results[0].value;
      expect(ctx.createOscillator).toHaveBeenCalledTimes(1);

      const startTone = ctx.createOscillator.mock.results[0].value;
      expect(startTone.frequency.setValueAtTime).toHaveBeenCalledWith(800, 0);
      expect(startTone.stop).toHaveBeenCalledWith(1); // one second long

      vi.advanceTimersByTime(1000); // 6 seconds left
      expect(ctx.createOscillator).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(5000); // 5,4,3,2,1 -> five beeps
      expect(ctx.createOscillator).toHaveBeenCalledTimes(6);

      vi.advanceTimersByTime(1000); // round ends -> session completion gong
      expect(ctx.createOscillator).toHaveBeenCalledTimes(7);
      const endTone = ctx.createOscillator.mock.results[6].value;
      expect(endTone.frequency.setValueAtTime).toHaveBeenCalledWith(150, 0);
      expect(text('phaseLabel')).toBe('DONE');
    });

    it('beeps during the countdown and plays a long beep when round 1 starts', () => {
      setInputs({
        countdown: 2,
        roundMin: 10,
        roundMax: 10,
        breakMin: 5,
        breakMax: 5,
        roundCount: 1
      });

      click('startPauseBtn');
      const ctx = window.AudioContext.mock.results[0].value;

      // Immediate countdown beep (800 Hz, 0.2s).
      expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
      const countdownBeep = ctx.createOscillator.mock.results[0].value;
      expect(countdownBeep.frequency.setValueAtTime).toHaveBeenCalledWith(800, 0);
      expect(countdownBeep.stop).toHaveBeenCalledWith(0.2);

      vi.advanceTimersByTime(1000); // 1 second left -> beep
      expect(ctx.createOscillator).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1000); // countdown over -> long start beep (800 Hz, 1s)
      expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
      const startTone = ctx.createOscillator.mock.results[2].value;
      expect(startTone.frequency.setValueAtTime).toHaveBeenCalledWith(800, 0);
      expect(startTone.stop).toHaveBeenCalledWith(1);
      expect(text('phaseLabel')).toBe('ROUND 1');
    });
  });
});
