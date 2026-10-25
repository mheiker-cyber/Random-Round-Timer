import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('index.html structure', () => {
  const htmlPath = path.resolve(__dirname, '../src/index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  it('should reference app.js', () => {
    expect(htmlContent).toContain('<script src="app.js"></script>');
  });

  it('should reference style.css', () => {
    expect(htmlContent).toContain('<link rel="stylesheet" href="style.css">');
  });

  it('should have start/pause button', () => {
    expect(htmlContent).toContain('id="startPauseBtn"');
  });

  it('should have stop button', () => {
    expect(htmlContent).toContain('id="stopBtn"');
  });

  it('should have options modal', () => {
    expect(htmlContent).toContain('id="optionsModal"');
  });

  it('should have time display', () => {
    expect(htmlContent).toContain('id="timeDisplay"');
  });
});
