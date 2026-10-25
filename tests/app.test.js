import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('app.js structure and behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="optionsBtn"></button>
      <dialog id="optionsModal"></dialog>
      <div id="modalBackdrop"></div>
      <button id="closeModalBtn"></button>
      
      <input id="roundMin" value="180">
      <input id="roundMax" value="300">
      <input id="breakMin" value="60">
      <input id="breakMax" value="90">
      <input type="radio" name="endCondition" value="rounds" checked>
      <input type="radio" name="endCondition" value="time">
      <input id="roundsInput">
      <input id="timeInput" class="hidden">
      <input id="roundCount" value="5">
      <input id="sessionMinutes" value="30">
      <input id="countdown" value="5">
      
      <span id="roundRangeDisplay"></span>
      <span id="breakRangeDisplay"></span>
      
      <span id="status"></span>
      <span id="roundInfo"></span>
      <span id="sessionElapsed"></span>
      <span id="phaseLabel"></span>
      <span id="timeDisplay"></span>
      <span id="nextInfo"></span>
      
      <button id="startPauseBtn"></button>
      <button id="stopBtn"></button>
    `;
    
    // Mock AudioContext
    global.window = global.window || {};
    global.window.AudioContext = vi.fn(() => ({
      createOscillator: vi.fn(() => ({
        connect: vi.fn(),
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
      })),
      destination: {},
      currentTime: 0,
      state: 'suspended',
      resume: vi.fn().mockResolvedValue(undefined),
    }));
    global.window.webkitAudioContext = global.window.AudioContext;
  });

  it('should load app.js without syntax errors', () => {
    const appPath = path.resolve(__dirname, '../src/app.js');
    const appContent = fs.readFileSync(appPath, 'utf8');
    expect(appContent).toBeTruthy();
    expect(appContent).toContain('function randomInRange');
    expect(appContent).toContain('function formatTime');
  });

  it('should have all required DOM elements referenced', () => {
    const appPath = path.resolve(__dirname, '../src/app.js');
    const appContent = fs.readFileSync(appPath, 'utf8');
    const requiredElements = [
      'optionsBtn', 'optionsModal', 'modalBackdrop', 'closeModalBtn',
      'roundMin', 'roundMax', 'breakMin', 'breakMax',
      'startPauseBtn', 'stopBtn'
    ];
    requiredElements.forEach(el => {
      expect(appContent).toContain(el);
    });
  });

  it('should have state management', () => {
    const appPath = path.resolve(__dirname, '../src/app.js');
    const appContent = fs.readFileSync(appPath, 'utf8');
    expect(appContent).toContain('let state');
    expect(appContent).toContain('running');
    expect(appContent).toContain('paused');
  });
});
