# Random Round Timer for BJJ

A web-based random round timer designed specifically for Brazilian Jiu Jitsu training. Randomize round and break durations within your specified ranges to keep training unpredictable and engaging.

## Features

- **Random Timings**: Set min/max for both rounds and breaks - each will be randomly selected
- **Flexible End Conditions**: End by number of rounds or by total session time
- **Configurable Countdown**: Adjustable pre-start countdown (default 5s) before rounds and breaks
- **Audio Signals**: 
  - Gong sound for round start and round end
  - Gong sound for break start and break end
  - Beep sounds during countdown
- **Session Tracking**: Displays current round, session elapsed time, and status
- **Easy Control**: Start and stop/cancel session at any time
- **No Dependencies**: Pure HTML, CSS, and JavaScript - runs in any modern browser
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Usage

1. Open `index.html` in a modern web browser
2. Configure your session:
   - Set round time range (min/max in seconds)
   - Set break time range (min/max in seconds)
   - Choose end condition (number of rounds or total session time)
   - Set pre-start countdown duration (seconds)
3. Click "Start Session"
4. Follow the timer - listen for audio cues
5. Click "Stop / Cancel Session" to end early if needed

## Running Locally

### Using Python
```bash
python3 -m http.server 8000
```
Then open [http://localhost:8000](http://localhost:8000)

### Using Node.js
```bash
npx serve .
```

### Using PHP
```bash
php -S localhost:8000
```

## Browser Compatibility

Requires a modern browser with support for:
- ES6 JavaScript
- Web Audio API
- CSS Grid and Flexbox

Tested on Chrome, Firefox, Safari, and Edge.

## Project Structure

```
random_round_timer/
├── index.html      # Main HTML structure
├── style.css       # Styling and responsive design
├── app.js          # Timer logic and audio generation
└── README.md       # This file
```

## Tips for BJJ Training

- **Rolling Rounds**: Try 3-5 minute rounds with random variation (e.g., 180-300s) to simulate unpredictable matches
- **Rest Periods**: Use shorter breaks (30-90s) or longer ones based on intensity
- **Competition Prep**: Set specific round counts matching your event format
- **Drilling**: Use time-based sessions for specific training goals

## License

MIT License - feel free to use, modify, and share!
