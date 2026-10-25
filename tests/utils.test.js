import { describe, it, expect } from 'vitest';

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

describe('utility functions', () => {
  describe('formatTime', () => {
    it('formats zero seconds as 00:00', () => {
      expect(formatTime(0)).toBe('00:00');
    });

    it('formats seconds only', () => {
      expect(formatTime(5)).toBe('00:05');
      expect(formatTime(59)).toBe('00:59');
    });

    it('formats minutes and seconds', () => {
      expect(formatTime(60)).toBe('01:00');
      expect(formatTime(65)).toBe('01:05');
      expect(formatTime(125)).toBe('02:05');
    });

    it('treats negative seconds as 0', () => {
      expect(formatTime(-1)).toBe('00:00');
      expect(formatTime(-10)).toBe('00:00');
    });
  });

  describe('randomInRange', () => {
    it('returns value within range inclusive', () => {
      for (let i = 0; i < 100; i++) {
        const result = randomInRange(10, 20);
        expect(result).toBeGreaterThanOrEqual(10);
        expect(result).toBeLessThanOrEqual(20);
      }
    });

    it('works with same min and max', () => {
      expect(randomInRange(5, 5)).toBe(5);
    });
  });
});
