// Inicjalizacja canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const restartButton = document.getElementById('restartButton');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('finalScore');

// Ustawienia canvas
function resizeCanvas() {
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;
    const aspectRatio = 16 / 9;
    
    if (maxWidth / maxHeight > aspectRatio) {
        canvas.height = maxHeight;
        canvas.width = maxHeight * aspectRatio;
    } else {
        canvas.width = maxWidth;
        canvas.height = maxWidth / aspectRatio;
    }
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Zmienne gry
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let gameSpeed = 2;
let logoImage = null;

// Załaduj logo
const logoImg = new Image();
logoImg.src = 'logo.svg';
logoImg.onload = () => {
    logoImage = logoImg;
};

// Klasa gracza
class Player {
    constructor() {
        this.width = 60;
        this.height = 60;
        this.x = canvas.width * 0.2;
        this.y = canvas.height / 2;
        this.velocityY = 0;
        this.gravity = 0.3;
        this.jumpPower = -8;
        this.boostPower = -10;
        this.rotation = 0;
    }
    
    update(windForce) {
        // Zastosuj siłę wiatru
        this.velocityY += windForce;
        
        // Zastosuj grawitację
        this.velocityY += this.gravity;
        
        // Aktualizuj pozycję
        this.y += this.velocityY;
        
        // Ograniczenia ekranu
        if (this.y < this.height / 2) {
            this.y = this.height / 2;
            this.velocityY = 0;
        }
        if (this.y > canvas.height - this.height / 2) {
            this.y = canvas.height - this.height / 2;
            this.velocityY = 0;
        }
        
        // Rotacja w zależności od prędkości
        this.rotation = Math.min(Math.max(this.velocityY * 0.1, -0.3), 0.3);
    }
    
    jump() {
        this.velocityY = this.boostPower;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Ciało gracza (prosty kształt)
        ctx.fillStyle = '#4A90E2';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Głowa
        ctx.fillStyle = '#FFDBAC';
        ctx.beginPath();
        ctx.arc(0, -this.height / 3, this.width / 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Logo na koszulce
        if (logoImage) {
            ctx.save();
            const logoSize = this.width * 0.4;
            ctx.drawImage(
                logoImage,
                -logoSize / 2,
                -logoSize / 4,
                logoSize,
                logoSize
            );
            ctx.restore();
        }
        
        // Skrzydła/ramiona (efekt wiatru)
        ctx.strokeStyle = '#87CEEB';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-this.width / 3, 0);
        ctx.lineTo(-this.width / 2, -this.height / 4);
        ctx.moveTo(this.width / 3, 0);
        ctx.lineTo(this.width / 2, -this.height / 4);
        ctx.stroke();
        
        ctx.restore();
    }
    
    getBounds() {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }
}

// Klasa turbiny wiatrowej
class WindTurbine {
    constructor(x) {
        this.x = x;
        this.y = canvas.height / 2;
        this.towerHeight = 150;
        this.towerWidth = 20;
        this.bladeLength = 80;
        this.bladeAngle = 0;
        this.bladeSpeed = 0.05;
        this.windLineLength = 300;
    }
    
    update() {
        this.bladeAngle += this.bladeSpeed;
        this.x -= gameSpeed;
    }
    
    draw() {
        // Wieża
        ctx.fillStyle = '#555';
        ctx.fillRect(
            this.x - this.towerWidth / 2,
            this.y,
            this.towerWidth,
            this.towerHeight
        );
        
        // Gondola (głowica)
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.ellipse(
            this.x,
            this.y,
            this.towerWidth * 1.5,
            this.towerWidth,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
        
        // Łopaty
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 4;
        ctx.save();
        ctx.translate(this.x, this.y);
        
        for (let i = 0; i < 3; i++) {
            ctx.save();
            ctx.rotate(this.bladeAngle + (i * Math.PI * 2 / 3));
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -this.bladeLength);
            ctx.stroke();
            ctx.restore();
        }
        
        ctx.restore();
        
        // Linia wiatru (gradientowa smuga)
        const gradient = ctx.createLinearGradient(
            this.x,
            this.y,
            this.x - this.windLineLength,
            this.y
        );
        gradient.addColorStop(0, 'rgba(135, 206, 235, 0.6)');
        gradient.addColorStop(0.5, 'rgba(135, 206, 235, 0.3)');
        gradient.addColorStop(1, 'rgba(135, 206, 235, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(
            this.x - this.windLineLength,
            this.y - 30,
            this.windLineLength,
            60
        );
        
        // Cząsteczki wiatru
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let i = 0; i < 10; i++) {
            const offsetX = -Math.random() * this.windLineLength;
            const offsetY = (Math.random() - 0.5) * 40;
            const size = Math.random() * 3 + 1;
            ctx.beginPath();
            ctx.arc(this.x + offsetX, this.y + offsetY, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    getWindForce(playerX) {
        const distance = this.x - playerX;
        if (distance > 0 && distance < this.windLineLength) {
            // Siła wiatru zmniejsza się z odległością
            return (1 - distance / this.windLineLength) * 0.15;
        }
        return 0;
    }
    
    isOffScreen() {
        return this.x + this.towerWidth < 0;
    }
}

// Klasa przeszkody
class Obstacle {
    constructor(x, type = 'platform') {
        this.x = x;
        this.type = type;
        
        if (type === 'platform') {
            this.width = 80;
            this.height = 20;
            this.y = Math.random() > 0.5 
                ? canvas.height - 100 
                : 100;
        } else if (type === 'cloud') {
            this.width = 100;
            this.height = 50;
            this.y = Math.random() * (canvas.height - 200) + 100;
        } else if (type === 'bird') {
            this.width = 40;
            this.height = 30;
            this.y = Math.random() * (canvas.height - 100) + 50;
            this.velocityY = (Math.random() - 0.5) * 2;
        }
    }
    
    update() {
        this.x -= gameSpeed;
        if (this.type === 'bird') {
            this.y += this.velocityY;
            if (this.y < 30 || this.y > canvas.height - 30) {
                this.velocityY *= -1;
            }
        }
    }
    
    draw() {
        if (this.type === 'platform') {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#654321';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        } else if (this.type === 'cloud') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(this.x + 20, this.y + 25, 15, 0, Math.PI * 2);
            ctx.arc(this.x + 40, this.y + 20, 20, 0, Math.PI * 2);
            ctx.arc(this.x + 60, this.y + 25, 15, 0, Math.PI * 2);
            ctx.arc(this.x + 50, this.y + 35, 12, 0, Math.PI * 2);
            ctx.arc(this.x + 30, this.y + 35, 12, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'bird') {
            ctx.fillStyle = '#654321';
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Skrzydła
            ctx.beginPath();
            ctx.arc(this.x - 10, this.y, 8, 0, Math.PI * 2);
            ctx.arc(this.x + 10, this.y, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
    
    isOffScreen() {
        return this.x + this.width < 0;
    }
}

// Klasa monety
class Coin {
    constructor(x) {
        this.x = x;
        this.y = Math.random() * (canvas.height - 200) + 100;
        this.radius = 15;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.pulseSpeed = 0.1;
        this.collected = false;
    }
    
    update() {
        this.x -= gameSpeed;
        this.pulsePhase += this.pulseSpeed;
    }
    
    draw() {
        if (this.collected) return;
        
        const pulseScale = 1 + Math.sin(this.pulsePhase) * 0.2;
        const currentRadius = this.radius * pulseScale;
        
        // Złoty kolor z gradientem
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, currentRadius
        );
        gradient.addColorStop(0, '#FFD700');
        gradient.addColorStop(0.5, '#FFA500');
        gradient.addColorStop(1, '#FF8C00');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Światło odbicia
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(
            this.x - currentRadius * 0.3,
            this.y - currentRadius * 0.3,
            currentRadius * 0.4,
            0,
            Math.PI * 2
        );
        ctx.fill();
        
        // Symbol $
        ctx.fillStyle = '#654321';
        ctx.font = `bold ${currentRadius * 0.8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', this.x, this.y);
    }
    
    getBounds() {
        return {
            x: this.x - this.radius,
            y: this.y - this.radius,
            width: this.radius * 2,
            height: this.radius * 2
        };
    }
    
    isOffScreen() {
        return this.x + this.radius < 0;
    }
}

// Funkcje kolizji
function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// Główna klasa gry
class Game {
    constructor() {
        this.player = new Player();
        this.turbines = [];
        this.obstacles = [];
        this.coins = [];
        this.turbineSpacing = 400;
        this.obstacleSpacing = 250;
        this.coinSpacing = 200;
        this.frameCount = 0;
        
        // Utwórz początkową turbinę
        this.turbines.push(new WindTurbine(canvas.width * 0.6));
    }
    
    update() {
        if (gameState !== 'playing') return;
        
        this.frameCount++;
        gameSpeed = 2 + Math.floor(this.frameCount / 1000) * 0.5;
        
        // Oblicz siłę wiatru z najbliższej turbiny
        let windForce = -0.1; // Podstawowa siła wiatru (lekko w górę)
        let nearestTurbine = null;
        let minDistance = Infinity;
        
        this.turbines.forEach(turbine => {
            const distance = Math.abs(turbine.x - this.player.x);
            if (distance < minDistance && turbine.x > this.player.x) {
                minDistance = distance;
                nearestTurbine = turbine;
            }
        });
        
        if (nearestTurbine) {
            windForce += nearestTurbine.getWindForce(this.player.x);
        }
        
        // Aktualizuj gracza
        this.player.update(windForce);
        
        // Aktualizuj turbiny
        this.turbines.forEach(turbine => turbine.update());
        this.turbines = this.turbines.filter(turbine => !turbine.isOffScreen());
        
        // Dodaj nowe turbiny
        const lastTurbineX = this.turbines.length > 0 
            ? Math.max(...this.turbines.map(t => t.x))
            : 0;
        if (lastTurbineX < canvas.width + this.turbineSpacing) {
            this.turbines.push(new WindTurbine(canvas.width + 100));
        }
        
        // Aktualizuj przeszkody
        this.obstacles.forEach(obstacle => obstacle.update());
        this.obstacles = this.obstacles.filter(obstacle => !obstacle.isOffScreen());
        
        // Dodaj nowe przeszkody
        const lastObstacleX = this.obstacles.length > 0
            ? Math.max(...this.obstacles.map(o => o.x + o.width))
            : 0;
        if (lastObstacleX < canvas.width + this.obstacleSpacing) {
            const types = ['platform', 'cloud', 'bird'];
            const type = types[Math.floor(Math.random() * types.length)];
            this.obstacles.push(new Obstacle(canvas.width + 100, type));
        }
        
        // Aktualizuj monety
        this.coins.forEach(coin => coin.update());
        this.coins = this.coins.filter(coin => !coin.isOffScreen() && !coin.collected);
        
        // Dodaj nowe monety
        const lastCoinX = this.coins.length > 0
            ? Math.max(...this.coins.map(c => c.x + c.radius))
            : 0;
        if (lastCoinX < canvas.width + this.coinSpacing) {
            this.coins.push(new Coin(canvas.width + 100));
        }
        
        // Sprawdź kolizje z przeszkodami
        const playerBounds = this.player.getBounds();
        for (let obstacle of this.obstacles) {
            if (checkCollision(playerBounds, obstacle.getBounds())) {
                this.gameOver();
                return;
            }
        }
        
        // Sprawdź zbieranie monet
        for (let coin of this.coins) {
            if (!coin.collected && checkCollision(playerBounds, coin.getBounds())) {
                coin.collected = true;
                score += 10;
                scoreDisplay.textContent = score;
            }
        }
    }
    
    draw() {
        // Tło z gradientem
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.3, '#E0F6FF');
        gradient.addColorStop(0.6, '#B0E0E6');
        gradient.addColorStop(1, '#87CEEB');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Chmury w tle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        for (let i = 0; i < 5; i++) {
            const cloudX = (this.frameCount * 0.5 + i * 200) % (canvas.width + 200) - 100;
            const cloudY = 50 + (i * 80) % (canvas.height - 100);
            ctx.beginPath();
            ctx.arc(cloudX, cloudY, 30, 0, Math.PI * 2);
            ctx.arc(cloudX + 40, cloudY, 40, 0, Math.PI * 2);
            ctx.arc(cloudX + 80, cloudY, 30, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Rysuj turbiny
        this.turbines.forEach(turbine => turbine.draw());
        
        // Rysuj przeszkody
        this.obstacles.forEach(obstacle => obstacle.draw());
        
        // Rysuj monety
        this.coins.forEach(coin => coin.draw());
        
        // Rysuj gracza
        this.player.draw();
    }
    
    gameOver() {
        gameState = 'gameOver';
        finalScoreDisplay.textContent = score;
        gameOverScreen.classList.remove('hidden');
    }
    
    reset() {
        this.player = new Player();
        this.turbines = [];
        this.obstacles = [];
        this.coins = [];
        this.frameCount = 0;
        score = 0;
        gameSpeed = 2;
        scoreDisplay.textContent = score;
        this.turbines.push(new WindTurbine(canvas.width * 0.6));
    }
}

// Inicjalizacja gry
const game = new Game();

// Obsługa zdarzeń
function handleInput() {
    if (gameState === 'start') {
        gameState = 'playing';
        startScreen.classList.add('hidden');
    } else if (gameState === 'playing') {
        game.player.jump();
    }
}

canvas.addEventListener('click', handleInput);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput();
});

restartButton.addEventListener('click', () => {
    game.reset();
    gameState = 'playing';
    gameOverScreen.classList.add('hidden');
});

// Pętla gry
function gameLoop() {
    game.update();
    game.draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

