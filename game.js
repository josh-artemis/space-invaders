// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Canvas dimensions (logical size)
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Set canvas logical size
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Responsive canvas sizing
function resizeCanvas() {
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth - 40; // Account for padding
    const aspectRatio = CANVAS_HEIGHT / CANVAS_WIDTH;
    
    // Calculate display size maintaining aspect ratio
    let displayWidth = containerWidth;
    let displayHeight = containerWidth * aspectRatio;
    
    // If height is too large, scale by height instead
    if (displayHeight > window.innerHeight * 0.7) {
        displayHeight = window.innerHeight * 0.7;
        displayWidth = displayHeight / aspectRatio;
    }
    
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
}

// Game state
let gameState = 'start'; // 'start', 'playing', 'paused', 'levelComplete', 'gameOver'
let score = 0;
let lives = 3;
let level = 1;
let playerName = 'Guest';
let isPaused = false;

// Audio setup
let audioContext;
let musicEnabled = true;
let musicOscillators = [];
let musicGainNode;
let musicIntervals = [];

// Game objects
let player;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];

// Star field
let stars = [];

// Input handling
const keys = {};
let mobileLeftPressed = false;
let mobileRightPressed = false;

// Player class
class Player {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = 5;
    }

    draw() {
        ctx.fillStyle = '#87ceeb';
        // Draw ship as a triangle
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        
        // Add glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#87ceeb';
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    update() {
        // Support both keyboard and mobile controls
        if ((keys['ArrowLeft'] || mobileLeftPressed) && this.x > 0) {
            this.x -= this.speed;
        }
        if ((keys['ArrowRight'] || mobileRightPressed) && this.x < canvas.width - this.width) {
            this.x += this.speed;
        }
    }

    shoot() {
        playerBullets.push(new Bullet(
            this.x + this.width / 2,
            this.y,
            3,
            10,
            -5,
            '#87ceeb'
        ));
    }
}

// Enemy class
class Enemy {
    constructor(x, y, width, height, bulletSpeed = 3) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = 1;
        this.direction = 1;
        this.shootChance = 0.001;
        this.bulletSpeed = bulletSpeed;
    }

    draw() {
        ctx.fillStyle = '#ff0000';
        // Draw enemy as a rectangle with eyes
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw eyes
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this.x + 5, this.y + 5, 8, 8);
        ctx.fillRect(this.x + this.width - 13, this.y + 5, 8, 8);
        
        // Add glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }

    update() {
        this.x += this.speed * this.direction;
        
        // Random shooting
        if (Math.random() < this.shootChance) {
            enemyBullets.push(new Bullet(
                this.x + this.width / 2,
                this.y + this.height,
                3,
                10,
                this.bulletSpeed,
                '#ff0000'
            ));
        }
    }

    changeDirection() {
        this.direction *= -1;
        this.y += 20; // Move down when hitting edge
    }
}

// Bullet class
class Bullet {
    constructor(x, y, width, height, speed, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.color = color;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        
        // Add glow
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }

    update() {
        this.y += this.speed;
    }

    isOffScreen() {
        return this.y < 0 || this.y > canvas.height;
    }
}

// Collision detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Enemy formation patterns
function createFormation(levelNum) {
    const formations = [
        // Level 1: Standard grid
        () => {
            const enemies = [];
            const enemyRows = 5;
            const enemyCols = 10;
            const enemyWidth = 40;
            const enemyHeight = 30;
            const spacing = 10;
            const startX = 50;
            const startY = 50;
            
            for (let row = 0; row < enemyRows; row++) {
                for (let col = 0; col < enemyCols; col++) {
                    enemies.push(new Enemy(
                        startX + col * (enemyWidth + spacing),
                        startY + row * (enemyHeight + spacing),
                        enemyWidth,
                        enemyHeight,
                        3 + levelNum * 0.5 // Base speed 3, increases with level
                    ));
                }
            }
            return enemies;
        },
        
        // Level 2: V-formation
        () => {
            return createVFormation(3 + levelNum * 0.5);
        },
        
        // Level 3: Diamond formation
        () => {
            const enemies = [];
            const enemyWidth = 40;
            const enemyHeight = 30;
            const spacing = 10;
            const centerX = canvas.width / 2;
            const startY = 50;
            const bulletSpeed = 3 + levelNum * 0.5;
            
            // Create diamond pattern
            const rows = [1, 3, 5, 3, 1];
            rows.forEach((count, row) => {
                const offset = (5 - count) * (enemyWidth + spacing) / 2;
                for (let i = 0; i < count; i++) {
                    enemies.push(new Enemy(
                        centerX - (count - 1) * (enemyWidth + spacing) / 2 + i * (enemyWidth + spacing) - enemyWidth / 2,
                        startY + row * (enemyHeight + spacing),
                        enemyWidth,
                        enemyHeight,
                        bulletSpeed
                    ));
                }
            });
            return enemies;
        },
        
        // Level 4: Two columns
        () => {
            const enemies = [];
            const enemyWidth = 40;
            const enemyHeight = 30;
            const spacing = 10;
            const bulletSpeed = 3 + levelNum * 0.5;
            
            const leftX = canvas.width / 4;
            const rightX = 3 * canvas.width / 4;
            const startY = 50;
            const rows = 8;
            
            for (let row = 0; row < rows; row++) {
                enemies.push(new Enemy(
                    leftX - enemyWidth / 2,
                    startY + row * (enemyHeight + spacing),
                    enemyWidth,
                    enemyHeight,
                    bulletSpeed
                ));
                enemies.push(new Enemy(
                    rightX - enemyWidth / 2,
                    startY + row * (enemyHeight + spacing),
                    enemyWidth,
                    enemyHeight,
                    bulletSpeed
                ));
            }
            return enemies;
        },
        
        // Level 5: Pyramid
        () => {
            const enemies = [];
            const enemyWidth = 40;
            const enemyHeight = 30;
            const spacing = 10;
            const centerX = canvas.width / 2;
            const startY = 50;
            const bulletSpeed = 3 + levelNum * 0.5;
            
            const maxWidth = 6;
            for (let row = 0; row < maxWidth; row++) {
                const count = maxWidth - row;
                for (let i = 0; i < count; i++) {
                    enemies.push(new Enemy(
                        centerX - (count - 1) * (enemyWidth + spacing) / 2 + i * (enemyWidth + spacing) - enemyWidth / 2,
                        startY + row * (enemyHeight + spacing),
                        enemyWidth,
                        enemyHeight,
                        bulletSpeed
                    ));
                }
            }
            return enemies;
        }
    ];
    
    // Cycle through formations based on level
    const formationIndex = (levelNum - 1) % formations.length;
    return formations[formationIndex]();
}

// Helper function for V-formation
function createVFormation(bulletSpeed) {
    const enemies = [];
    const enemyWidth = 40;
    const enemyHeight = 30;
    const spacing = 10;
    const centerX = canvas.width / 2;
    const startY = 50;
    
    const rows = 5;
    for (let row = 0; row < rows; row++) {
        const count = row + 1;
        const rowWidth = count * (enemyWidth + spacing) - spacing;
        const startX = centerX - rowWidth / 2;
        
        for (let i = 0; i < count; i++) {
            enemies.push(new Enemy(
                startX + i * (enemyWidth + spacing),
                startY + row * (enemyHeight + spacing),
                enemyWidth,
                enemyHeight,
                bulletSpeed
            ));
        }
    }
    return enemies;
}

// Initialize stars
function initStars() {
    stars = [];
    const starCount = 100;
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            brightness: Math.random(),
            twinkleSpeed: Math.random() * 0.02 + 0.01
        });
    }
}

// Draw stars
function drawStars() {
    ctx.fillStyle = '#ffffff';
    stars.forEach(star => {
        // Twinkling effect
        star.brightness += star.twinkleSpeed;
        if (star.brightness > 1) {
            star.brightness = 0;
        }
        
        const alpha = 0.5 + Math.sin(star.brightness * Math.PI * 2) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

// Initialize game
function initGame() {
    // Create player
    player = new Player(canvas.width / 2 - 25, canvas.height - 50, 50, 30);
    
    // Create enemies based on level formation
    enemies = createFormation(level);
    
    // Set enemy direction
    enemies.forEach(enemy => {
        enemy.direction = 1;
    });
    
    playerBullets = [];
    enemyBullets = [];
    
    updateUI();
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('level').textContent = level;
    document.getElementById('playerName').textContent = playerName;
    
    // Update pause button icon
    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton) {
        pauseButton.textContent = isPaused ? '▶️' : '⏸️';
        pauseButton.style.display = gameState === 'playing' ? 'inline-block' : 'none';
    }
    
    // Show/hide mobile controls based on game state and device type
    const mobileControls = document.getElementById('mobileControls');
    if (mobileControls) {
        const isMobile = window.innerWidth <= 768;
        mobileControls.style.display = (gameState === 'playing' && isMobile) ? 'block' : 'none';
    }
}

// Game loop
function gameLoop() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw stars background
    drawStars();
    
    if (gameState === 'playing' && !isPaused) {
        // Update player
        player.update();
        player.draw();
        
        // Update enemies
        let enemyHitEdge = false;
        enemies.forEach(enemy => {
            enemy.update();
            enemy.draw();
            
            // Check if enemy hit edge
            if (enemy.x <= 0 || enemy.x + enemy.width >= canvas.width) {
                enemyHitEdge = true;
            }
            
            // Check if enemy reached bottom
            if (enemy.y + enemy.height >= player.y) {
                gameOver();
            }
        });
        
        // Change all enemy directions if one hit edge
        if (enemyHitEdge) {
            enemies.forEach(enemy => {
                enemy.changeDirection();
            });
        }
        
        // Update player bullets
        playerBullets = playerBullets.filter(bullet => {
            bullet.update();
            bullet.draw();
            
            // Check collision with enemies
            for (let i = enemies.length - 1; i >= 0; i--) {
                if (checkCollision(bullet, enemies[i])) {
                    enemies.splice(i, 1);
                    score += 10;
                    updateUI();
                    return false; // Remove bullet
                }
            }
            
            return !bullet.isOffScreen();
        });
        
        // Update enemy bullets
        enemyBullets = enemyBullets.filter(bullet => {
            bullet.update();
            bullet.draw();
            
            // Check collision with player
            if (checkCollision(bullet, player)) {
                lives--;
                updateUI();
                if (lives <= 0) {
                    gameOver();
                }
                return false; // Remove bullet
            }
            
            return !bullet.isOffScreen();
        });
        
        // Check win condition
        if (enemies.length === 0) {
            // Level complete - show completion screen
            levelComplete();
        }
    } else if (gameState === 'playing' && isPaused) {
        // Draw game objects but don't update them when paused
        player.draw();
        enemies.forEach(enemy => enemy.draw());
        playerBullets.forEach(bullet => bullet.draw());
        enemyBullets.forEach(bullet => bullet.draw());
    }
    
    requestAnimationFrame(gameLoop);
}

// Get funny level completion message
function getLevelMessage(completedLevel) {
    const messages = [
        // Level 1
        "You survived your first space battle! The aliens are NOT impressed.",
        // Level 2
        "Two levels down! Your ship is still in one piece... mostly.",
        // Level 3
        "Level 3 complete! The space invaders are starting to take you seriously.",
        // Level 4
        "You're still alive! The aliens are calling their friends now.",
        // Level 5
        "Halfway to legend! Your piloting skills are... adequate.",
        // Level 6
        "Level 6 conquered! The aliens are writing angry space letters.",
        // Level 7
        "Seven levels of survival! You're like a space cockroach - unkillable!",
        // Level 8
        "Level 8 done! The aliens are considering early retirement.",
        // Level 9
        "Nine levels of glory! You're making space look easy.",
        // Level 10
        "Double digits! The aliens have formed a support group.",
        // Level 11+
        "Another level down! You're basically a space legend now.",
        "Still going! The aliens are questioning their life choices.",
        "Unstoppable! The space invaders are filing complaints.",
        "Level after level! You're the reason aliens have nightmares.",
        "Incredible! The aliens are updating their resumes.",
        "Amazing! You're single-handedly solving the alien problem.",
        "Outstanding! The space invaders are considering a career change.",
        "Phenomenal! You're making space look like a walk in the park.",
        "Legendary! The aliens are starting to respect you... and fear you.",
        "Unbelievable! You're the stuff of space legends!"
    ];
    
    // Use specific message for levels 1-10, then cycle through the rest
    if (completedLevel <= messages.length) {
        return messages[completedLevel - 1];
    } else {
        // Cycle through messages 11-20 for higher levels
        const index = 10 + ((completedLevel - 11) % 10);
        return messages[index];
    }
}

// Level complete function
function levelComplete() {
    gameState = 'levelComplete';
    isPaused = false;
    
    // Calculate bonus points
    const bonus = 100 * level;
    score += bonus;
    
    // Update UI
    updateUI();
    
    // Show level completion screen
    document.getElementById('levelMessage').textContent = getLevelMessage(level);
    document.getElementById('completedLevel').textContent = level;
    document.getElementById('levelBonus').textContent = bonus;
    document.getElementById('levelCompleteScreen').classList.remove('hidden');
    
    // Stop music during level transition
    stopMusic();
}

// Start next level
function startNextLevel() {
    level++;
    gameState = 'playing';
    isPaused = false;
    document.getElementById('levelCompleteScreen').classList.add('hidden');
    initGame();
    
    // Resume music
    if (musicEnabled) {
        createSpaceMusic();
    }
}

// Pause/Resume functions
function pauseGame() {
    if (gameState === 'playing' && !isPaused) {
        isPaused = true;
        document.getElementById('pauseScreen').classList.remove('hidden');
    }
}

function resumeGame() {
    if (gameState === 'playing' && isPaused) {
        isPaused = false;
        document.getElementById('pauseScreen').classList.add('hidden');
    }
}

function togglePause() {
    if (isPaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

// Game over
function gameOver() {
    gameState = 'gameOver';
    isPaused = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalLevel').textContent = level;
    document.getElementById('finalPlayerName').textContent = playerName;
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('levelCompleteScreen').classList.add('hidden');
    
    // Stop music on game over
    stopMusic();
}

// Music functions
function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        musicGainNode = audioContext.createGain();
        musicGainNode.connect(audioContext.destination);
        musicGainNode.gain.value = 0.3; // Set volume to 30%
    } catch (e) {
        console.log('Web Audio API not supported');
    }
}

function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function createSpaceMusic() {
    if (!audioContext || !musicEnabled) return;
    
    // Resume audio context if suspended (browser autoplay policy)
    resumeAudioContext();
    
    // Clear existing oscillators
    stopMusic();
    
    const now = audioContext.currentTime;
    const bpm = 140; // Fast tempo
    const beatDuration = 60 / bpm;
    
    // Driving bass line - pulsing rhythm
    const bassFreqs = [55, 55, 73.42, 55, 73.42, 55]; // A, A, D, A, D, A pattern
    
    // Repeating bass pattern using setInterval
    let bassPatternIndex = 0;
    const bassInterval = setInterval(() => {
        if (!musicEnabled) {
            clearInterval(bassInterval);
            return;
        }
        
        const freq = bassFreqs[bassPatternIndex % bassFreqs.length];
        const bassOsc = audioContext.createOscillator();
        const bassGain = audioContext.createGain();
        bassOsc.type = 'square';
        bassOsc.frequency.value = freq;
        
        const beatStart = audioContext.currentTime;
        const beatEnd = beatStart + beatDuration * 0.4;
        
        bassGain.gain.setValueAtTime(0, beatStart);
        bassGain.gain.linearRampToValueAtTime(0.25, beatStart + 0.01);
        bassGain.gain.linearRampToValueAtTime(0.25, beatEnd - 0.01);
        bassGain.gain.linearRampToValueAtTime(0, beatEnd);
        
        bassOsc.connect(bassGain);
        bassGain.connect(musicGainNode);
        bassOsc.start(beatStart);
        bassOsc.stop(beatEnd + 0.1);
        
        musicOscillators.push({ oscillator: bassOsc, gainNode: bassGain });
        bassPatternIndex++;
    }, beatDuration * 0.5 * 1000); // Convert to milliseconds
    
    musicIntervals.push(bassInterval);
    
    // Melodic lead - fast arpeggio pattern
    const leadFreqs = [220, 261.63, 293.66, 329.63, 349.23, 392, 440, 493.88]; // C major scale
    let leadNoteIndex = 0;
    const leadInterval = setInterval(() => {
        if (!musicEnabled) {
            clearInterval(leadInterval);
            return;
        }
        
        const freq = leadFreqs[leadNoteIndex % leadFreqs.length];
        const leadOsc = audioContext.createOscillator();
        const leadGain = audioContext.createGain();
        leadOsc.type = 'square';
        leadOsc.frequency.value = freq;
        
        const noteDuration = beatDuration * 0.25; // Fast notes
        const noteStart = audioContext.currentTime;
        const noteEnd = noteStart + noteDuration * 0.8;
        
        leadGain.gain.setValueAtTime(0, noteStart);
        leadGain.gain.linearRampToValueAtTime(0.2, noteStart + 0.005);
        leadGain.gain.linearRampToValueAtTime(0.2, noteEnd - 0.005);
        leadGain.gain.linearRampToValueAtTime(0, noteEnd);
        
        leadOsc.connect(leadGain);
        leadGain.connect(musicGainNode);
        leadOsc.start(noteStart);
        leadOsc.stop(noteEnd + 0.05);
        
        musicOscillators.push({ oscillator: leadOsc, gainNode: leadGain });
        leadNoteIndex++;
    }, beatDuration * 0.25 * 1000); // Convert to milliseconds
    
    musicIntervals.push(leadInterval);
    
    // Harmonic pad - faster pulsing chords
    const chordFreqs = [
        [220, 261.63, 329.63], // C major
        [246.94, 293.66, 369.99], // D minor
        [196, 246.94, 293.66], // G major
        [220, 261.63, 329.63]  // C major
    ];
    let chordIndex = 0;
    const chordInterval = setInterval(() => {
        if (!musicEnabled) {
            clearInterval(chordInterval);
            return;
        }
        
        const chord = chordFreqs[chordIndex % chordFreqs.length];
        
        chord.forEach((freq) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            
            const chordDuration = beatDuration * 2;
            const chordStart = audioContext.currentTime;
            const chordEnd = chordStart + chordDuration;
            
            // Pulsing envelope
            gain.gain.setValueAtTime(0, chordStart);
            gain.gain.linearRampToValueAtTime(0.12, chordStart + 0.05);
            gain.gain.linearRampToValueAtTime(0.12, chordEnd - 0.05);
            gain.gain.linearRampToValueAtTime(0, chordEnd);
            
            osc.connect(gain);
            gain.connect(musicGainNode);
            osc.start(chordStart);
            osc.stop(chordEnd + 0.1);
            
            musicOscillators.push({ oscillator: osc, gainNode: gain });
        });
        
        chordIndex++;
    }, beatDuration * 2000);
    
    musicIntervals.push(chordInterval);
}

function stopMusic() {
    // Clear all intervals
    musicIntervals.forEach(interval => clearInterval(interval));
    musicIntervals = [];
    
    // Stop all oscillators
    musicOscillators.forEach((item) => {
        try {
            const { oscillator, lfo, gainNode } = item;
            if (gainNode && audioContext) {
                const now = audioContext.currentTime;
                gainNode.gain.cancelScheduledValues(now);
                gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
                setTimeout(() => {
                    try {
                        oscillator.stop();
                        if (lfo) lfo.stop();
                    } catch (e) {
                        // Already stopped
                    }
                }, 100);
            } else {
                try {
                    oscillator.stop();
                    if (lfo) lfo.stop();
                } catch (e) {
                    // Already stopped
                }
            }
        } catch (e) {
            // Oscillator already stopped
        }
    });
    musicOscillators = [];
}

function toggleMusic() {
    // Resume audio context on user interaction
    resumeAudioContext();
    
    musicEnabled = !musicEnabled;
    const button = document.getElementById('musicToggle');
    button.textContent = musicEnabled ? '🔊' : '🔇';
    
    if (musicEnabled && gameState === 'playing') {
        createSpaceMusic();
    } else {
        stopMusic();
    }
}

// Start game
function startGame() {
    // Get player name from input
    const nameInput = document.getElementById('playerNameInput');
    const inputName = nameInput.value.trim();
    
    // Use input name or default to "Guest"
    if (inputName) {
        playerName = inputName;
    } else {
        playerName = 'Guest';
    }
    
    gameState = 'playing';
    isPaused = false;
    score = 0;
    lives = 3;
    level = 1; // Reset level when starting new game
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('levelCompleteScreen').classList.add('hidden');
    initGame();
    
    // Start music when game begins
    if (musicEnabled) {
        createSpaceMusic();
    }
}

// Event listeners
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    // Resume audio context on any user interaction
    resumeAudioContext();
    
    // Pause/Resume with P key
    if ((e.key === 'p' || e.key === 'P') && gameState === 'playing') {
        e.preventDefault();
        togglePause();
        return;
    }
    
    // Don't allow shooting when paused
    if (e.key === ' ' && gameState === 'playing' && !isPaused) {
        e.preventDefault();
        player.shoot();
    }
    
    // Allow Enter key to submit name and start game
    if (e.key === 'Enter' && gameState === 'start') {
        const nameInput = document.getElementById('playerNameInput');
        if (document.activeElement === nameInput || !document.activeElement) {
            e.preventDefault();
            startGame();
        }
    }
    
    // Allow Enter or Space to continue to next level
    if ((e.key === 'Enter' || e.key === ' ') && gameState === 'levelComplete') {
        e.preventDefault();
        startNextLevel();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('click', startGame);
document.getElementById('resumeButton').addEventListener('click', resumeGame);
document.getElementById('nextLevelButton').addEventListener('click', startNextLevel);
document.getElementById('pauseButton').addEventListener('click', togglePause);
document.getElementById('musicToggle').addEventListener('click', toggleMusic);

// Mobile control buttons
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const shootBtn = document.getElementById('shootBtn');

// Mobile button event handlers
if (leftBtn) {
    leftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mobileLeftPressed = true;
    });
    leftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileLeftPressed = false;
    });
    leftBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        mobileLeftPressed = true;
    });
    leftBtn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        mobileLeftPressed = false;
    });
    leftBtn.addEventListener('mouseleave', () => {
        mobileLeftPressed = false;
    });
}

if (rightBtn) {
    rightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        mobileRightPressed = true;
    });
    rightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        mobileRightPressed = false;
    });
    rightBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        mobileRightPressed = true;
    });
    rightBtn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        mobileRightPressed = false;
    });
    rightBtn.addEventListener('mouseleave', () => {
        mobileRightPressed = false;
    });
}

if (shootBtn) {
    shootBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (gameState === 'playing' && !isPaused) {
            player.shoot();
        }
    });
    shootBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (gameState === 'playing' && !isPaused) {
            player.shoot();
        }
    });
}

// Prevent default touch behaviors
document.addEventListener('touchmove', (e) => {
    if (gameState === 'playing') {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchstart', (e) => {
    // Allow touches on buttons and inputs
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
        return;
    }
    if (gameState === 'playing') {
        e.preventDefault();
    }
}, { passive: false });

// Prevent zooming on double tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Prevent context menu on long press
document.addEventListener('contextmenu', (e) => {
    if (gameState === 'playing') {
        e.preventDefault();
    }
});

// Focus name input on page load and initialize pause button
window.addEventListener('load', () => {
    const nameInput = document.getElementById('playerNameInput');
    if (nameInput) {
        nameInput.focus();
    }
    
    // Initialize pause button (hidden initially)
    const pauseButton = document.getElementById('pauseButton');
    if (pauseButton) {
        pauseButton.style.display = 'none';
    }
    
    // Resize canvas on load
    resizeCanvas();
});

// Resize canvas on window resize
window.addEventListener('resize', () => {
    resizeCanvas();
    updateUI(); // Update mobile controls visibility
});

// Resize canvas on orientation change
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        resizeCanvas();
    }, 100);
});

// Initialize stars, audio and start game loop
initStars();
initAudio();
gameLoop();

