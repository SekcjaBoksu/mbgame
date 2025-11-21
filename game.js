// Inicjalizacja canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const restartButton = document.getElementById('restartButton');
const startButton = document.getElementById('startButton');
const scoreDisplay = document.getElementById('score');
const finalScoreDisplay = document.getElementById('finalScore');

// Ustawienia canvas - węższy ekran
function resizeCanvas() {
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;
    const aspectRatio = 4 / 3; // Węższy ekran
    
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

// Polyfill dla roundRect (dla starszych przeglądarek)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
    };
}

// Zmienne gry
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let score = 0;
let horizontalSpeed = 0; // Prędkość pozioma kontrolowana przez wiatr
let logoImage = null;
let gameProgress = 0; // Postęp w grze (odległość przebyta)
let scrollOffset = 0; // Offset scrollowania planszy
const groundHeight = 80; // Wysokość podłoża

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
        this.x = canvas.width * 0.15; // Stała pozycja X (po lewej stronie)
        this.y = canvas.height / 2;
        this.velocityY = 0;
        this.gravity = 0.4;
        this.boostPower = -9;
        this.rotation = 0;
    }
    
    update() {
        // Tylko grawitacja - postać opada
        this.velocityY += this.gravity;
        
        // Aktualizuj pozycję Y
        this.y += this.velocityY;
        
        // Ograniczenia ekranu (góra)
        if (this.y < this.height / 2) {
            this.y = this.height / 2;
            this.velocityY = 0;
        }
        
        // Kolizja z ziemią - Game Over
        const groundY = canvas.height - groundHeight;
        if (this.y + this.height / 2 > groundY) {
            return true; // Zwróć true jeśli kolizja z ziemią
        }
        
        // Rotacja w zależności od prędkości
        this.rotation = Math.min(Math.max(this.velocityY * 0.1, -0.3), 0.3);
        return false;
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

// Klasa turbiny wiatrowej (scrolluje się z planszą)
class WindTurbine {
    constructor(worldX, towerHeight) {
        this.worldX = worldX; // Pozycja w świecie (scrolluje się)
        this.towerHeight = towerHeight; // Długość wieży (różna dla każdej turbiny)
        this.towerWidth = 15;
        this.bladeLength = 60;
        this.bladeAngle = 0;
        this.bladeSpeed = -0.03; // Odwrócony kierunek obrotu (wiatr wieje od lewej)
        this.windLineLength = canvas.width * 0.6; // Długa linia wiatru od lewej do prawej
    }
    
    getScreenX() {
        return this.worldX - scrollOffset;
    }
    
    getBaseY() {
        // Podstawa zawsze na ziemi
        return canvas.height - groundHeight;
    }
    
    getGondolaY() {
        // Gondola na szczycie wieży
        return this.getBaseY() - this.towerHeight;
    }
    
    update() {
        this.bladeAngle += this.bladeSpeed;
    }
    
    draw() {
        const screenX = this.getScreenX();
        const baseY = this.getBaseY();
        const gondolaY = this.getGondolaY();
        
        // Sprawdź czy wiatrak jest na ekranie
        if (screenX < -50 || screenX > canvas.width + 50) {
            return; // Nie rysuj jeśli poza ekranem
        }
        
        // Sprawdź czy gondola nie jest za wysoko (poza ekranem)
        if (gondolaY < -100) {
            return;
        }
        
        // Wieża (ciemniejsza, w tle) - od gondoli do podstawy (ziemi)
        ctx.fillStyle = '#555';
        ctx.fillRect(
            screenX - this.towerWidth / 2,
            gondolaY,
            this.towerWidth,
            this.towerHeight
        );
        
        // Gondola (głowica)
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.ellipse(
            screenX,
            gondolaY,
            this.towerWidth * 1.5,
            this.towerWidth,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
        
        // Łopaty (odwrócone - wiatr wieje od lewej)
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 4;
        ctx.save();
        ctx.translate(screenX, gondolaY);
        
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
        
        // Linia wiatru (od lewej do prawej - wiatr napędza gracza)
        const playerX = canvas.width * 0.15;
        
        // Wiatr wieje od lewej strony wiatraka w stronę gracza
        if (screenX > playerX) {
            const startX = Math.max(0, screenX - this.windLineLength);
            const endX = playerX;
            
            if (endX > startX) {
                const gradient = ctx.createLinearGradient(
                    startX,
                    gondolaY,
                    endX,
                    gondolaY
                );
                gradient.addColorStop(0, 'rgba(135, 206, 235, 0.5)');
                gradient.addColorStop(0.5, 'rgba(135, 206, 235, 0.3)');
                gradient.addColorStop(1, 'rgba(135, 206, 235, 0)');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(
                    startX,
                    gondolaY - 40,
                    endX - startX,
                    80
                );
                
                // Cząsteczki wiatru (poruszają się od lewej do prawej)
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                for (let i = 0; i < 10; i++) {
                    const progress = Math.random();
                    const offsetX = startX + (endX - startX) * progress;
                    const offsetY = gondolaY + (Math.random() - 0.5) * 50;
                    const size = Math.random() * 2 + 1;
                    ctx.beginPath();
                    ctx.arc(offsetX, offsetY, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
    
    getWindForce() {
        // Turbina generuje siłę wiatru napędzającą gracza w prawo
        const playerX = canvas.width * 0.15;
        const screenX = this.getScreenX();
        const distance = Math.abs(screenX - playerX);
        
        // Siła wiatru zależy od odległości - im bliżej, tym silniejszy wiatr
        if (distance < this.windLineLength && screenX > playerX) {
            return 0.4 + (1 - distance / this.windLineLength) * 0.3; // 0.4-0.7
        }
        return 0;
    }
    
    isOffScreen() {
        const screenX = this.getScreenX();
        return screenX + 50 < 0;
    }
}

// Klasa przeszkody (ptak - leci w stronę gracza)
class Obstacle {
    constructor(worldX) {
        this.worldX = worldX; // Pozycja w świecie
        this.width = 35;
        this.height = 25;
        this.y = Math.random() * (canvas.height - groundHeight - 150) + 75;
        this.speed = 3 + Math.random() * 2; // Prędkość lecenia w stronę gracza
        this.velocityY = (Math.random() - 0.5) * 1.5; // Lekkie poruszanie w górę/dół
    }
    
    getScreenX() {
        return this.worldX - scrollOffset;
    }
    
    update() {
        // Przeszkoda leci w stronę gracza (w lewo) - scrolluje się z planszą
        this.worldX -= this.speed;
        
        // Lekkie poruszanie w górę/dół
        this.y += this.velocityY;
        const groundY = canvas.height - groundHeight;
        if (this.y < 30 || this.y > groundY - 30) {
            this.velocityY *= -1;
        }
    }
    
    draw() {
        const screenX = this.getScreenX();
        
        // Uproszczony kształt ptaka
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.ellipse(screenX, this.y, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Skrzydła
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.arc(screenX - 8, this.y, 7, 0, Math.PI * 2);
        ctx.arc(screenX + 8, this.y, 7, 0, Math.PI * 2);
        ctx.fill();
        
        // Dziób
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.moveTo(screenX - this.width / 2, this.y);
        ctx.lineTo(screenX - this.width / 2 - 5, this.y - 3);
        ctx.lineTo(screenX - this.width / 2 - 5, this.y + 3);
        ctx.closePath();
        ctx.fill();
    }
    
    getBounds() {
        const screenX = this.getScreenX();
        return {
            x: screenX - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }
    
    isOffScreen() {
        const screenX = this.getScreenX();
        return screenX + this.width < 0;
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
        this.frameCount = 0;
        this.lastObstacleTime = 0;
        this.obstacleInterval = 2000; // Co 2 sekundy nowa przeszkoda (w milisekundach)
        scrollOffset = 0;
        
        // Utwórz początkowe turbiny na różnych wysokościach podstawy
        this.turbines.push(new WindTurbine(300, 80));
        this.turbines.push(new WindTurbine(600, 150));
        this.turbines.push(new WindTurbine(900, 100));
    }
    
    update() {
        if (gameState !== 'playing') return;
        
        this.frameCount++;
        
        // Oblicz prędkość poziomą na podstawie siły wiatru
        let windForce = 0;
        this.turbines.forEach(turbine => {
            windForce += turbine.getWindForce();
        });
        horizontalSpeed = Math.max(0.5, windForce); // Minimalna prędkość
        gameProgress += horizontalSpeed;
        
        // Scrollowanie planszy (świat przesuwa się w lewo)
        scrollOffset += horizontalSpeed;
        
        // Aktualizuj gracza (tylko ruch w górę/dół)
        const hitGround = this.player.update();
        if (hitGround) {
            this.gameOver();
            return;
        }
        
        // Aktualizuj turbiny (tylko animacja łopat)
        this.turbines.forEach(turbine => turbine.update());
        this.turbines = this.turbines.filter(turbine => !turbine.isOffScreen());
        
        // Dodaj nowe turbiny w miarę scrollowania
        const lastTurbineX = this.turbines.length > 0
            ? Math.max(...this.turbines.map(t => t.worldX))
            : scrollOffset;
        
        if (lastTurbineX - scrollOffset < canvas.width + 300) {
            // Różne długości wież (wszystkie podstawy na ziemi)
            const towerHeight = 100 + Math.random() * 120; // Od 100 do 220 pikseli
            const newX = Math.max(lastTurbineX + 400, scrollOffset + canvas.width + 200);
            this.turbines.push(new WindTurbine(newX, towerHeight));
        }
        
        // Aktualizuj przeszkody (lecą w stronę gracza)
        this.obstacles.forEach(obstacle => obstacle.update());
        this.obstacles = this.obstacles.filter(obstacle => !obstacle.isOffScreen());
        
        // Dodaj nowe przeszkody (rzadziej, mniej na ekranie)
        const currentTime = Date.now();
        if (currentTime - this.lastObstacleTime > this.obstacleInterval) {
            // Maksymalnie 3 przeszkody na ekranie
            if (this.obstacles.length < 3) {
                this.obstacles.push(new Obstacle(scrollOffset + canvas.width + 50));
                this.lastObstacleTime = currentTime;
                // Zwiększ częstotliwość z czasem
                this.obstacleInterval = Math.max(1500, 2000 - Math.floor(this.frameCount / 500) * 100);
            }
        }
        
        // Sprawdź kolizje z przeszkodami
        const playerBounds = this.player.getBounds();
        for (let obstacle of this.obstacles) {
            if (checkCollision(playerBounds, obstacle.getBounds())) {
                this.gameOver();
                return;
            }
        }
        
        // Zwiększ wynik w zależności od postępu
        score = Math.floor(gameProgress / 10);
        scoreDisplay.textContent = score;
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
        
        // Chmury w tle (mniej, bardziej subtelne, scrollują się wolniej)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        for (let i = 0; i < 3; i++) {
            const cloudWorldX = (i * 400) - (scrollOffset * 0.2);
            const cloudX = ((cloudWorldX % 1200) + 1200) % 1200;
            const cloudY = 60 + (i * 120) % (canvas.height - groundHeight - 120);
            if (cloudX < canvas.width + 100) {
                ctx.beginPath();
                ctx.arc(cloudX, cloudY, 25, 0, Math.PI * 2);
                ctx.arc(cloudX + 35, cloudY, 35, 0, Math.PI * 2);
                ctx.arc(cloudX + 70, cloudY, 25, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Rysuj podłoże (ziemia)
        const groundY = canvas.height - groundHeight;
        
        // Główna część ziemi
        const groundGradient = ctx.createLinearGradient(0, groundY, 0, canvas.height);
        groundGradient.addColorStop(0, '#8B7355');
        groundGradient.addColorStop(0.3, '#6B5D4F');
        groundGradient.addColorStop(1, '#5A4A3A');
        ctx.fillStyle = groundGradient;
        ctx.fillRect(0, groundY, canvas.width, groundHeight);
        
        // Trawa na górze ziemi
        ctx.fillStyle = '#7CB342';
        ctx.fillRect(0, groundY, canvas.width, 8);
        
        // Tekstura ziemi (kamyki/ziarno)
        ctx.fillStyle = 'rgba(90, 74, 58, 0.3)';
        for (let i = 0; i < 20; i++) {
            const x = (scrollOffset * 0.5 + i * 50) % canvas.width;
            const y = groundY + 10 + Math.sin(i) * 5;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Rysuj turbiny w tle
        this.turbines.forEach(turbine => turbine.draw());
        
        // Rysuj przeszkody
        this.obstacles.forEach(obstacle => obstacle.draw());
        
        // Rysuj gracza (na pierwszym planie)
        this.player.draw();
        
        // Rysuj menu startowe na canvasie
        if (gameState === 'start') {
            this.drawStartMenu();
        }
        
        // Rysuj ekran Game Over na canvasie
        if (gameState === 'gameOver') {
            this.drawGameOverScreen();
        }
    }
    
    drawStartMenu() {
        // Półprzezroczyste tło
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Tło menu
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const menuWidth = Math.min(400, canvas.width * 0.8);
        const menuHeight = 280;
        
        // Zaokrąglony prostokąt (symulacja)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(menuX - menuWidth / 2, menuY - menuHeight / 2, menuWidth, menuHeight, 20);
        ctx.fill();
        
        // Cień
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
        
        // Tytuł
        ctx.fillStyle = '#2C5F8D';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent';
        ctx.fillText('Wind Runner', menuX, menuY - 80);
        
        // Podtytuł
        ctx.fillStyle = '#4A90E2';
        ctx.font = 'italic 18px Arial';
        ctx.fillText('Użyj siły wiatru, aby lecieć!', menuX, menuY - 30);
        
        // Przycisk Start (prostokąt z zaokrąglonymi rogami)
        const buttonY = menuY + 20;
        const buttonWidth = 200;
        const buttonHeight = 50;
        
        // Tło przycisku
        const buttonGradient = ctx.createLinearGradient(
            menuX - buttonWidth / 2,
            buttonY - buttonHeight / 2,
            menuX + buttonWidth / 2,
            buttonY + buttonHeight / 2
        );
        buttonGradient.addColorStop(0, '#4A90E2');
        buttonGradient.addColorStop(1, '#2C5F8D');
        ctx.fillStyle = buttonGradient;
        ctx.beginPath();
        ctx.roundRect(menuX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 25);
        ctx.fill();
        
        // Tekst przycisku
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('START', menuX, buttonY + 8);
        
        // Instrukcje
        ctx.fillStyle = '#888';
        ctx.font = 'italic 14px Arial';
        ctx.fillText('Kliknij ekran, aby wznieść się wyżej', menuX, menuY + 100);
    }
    
    drawGameOverScreen() {
        // Półprzezroczyste tło
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Tło menu
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const menuWidth = Math.min(350, canvas.width * 0.8);
        const menuHeight = 220;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(menuX - menuWidth / 2, menuY - menuHeight / 2, menuWidth, menuHeight, 20);
        ctx.fill();
        
        // Tytuł Game Over
        ctx.fillStyle = '#E2001A';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Game Over', menuX, menuY - 60);
        
        // Wynik
        ctx.fillStyle = '#555';
        ctx.font = '20px Arial';
        ctx.fillText(`Twój wynik: ${score}`, menuX, menuY - 10);
        
        // Przycisk Restart
        const buttonY = menuY + 50;
        const buttonWidth = 180;
        const buttonHeight = 45;
        
        const buttonGradient = ctx.createLinearGradient(
            menuX - buttonWidth / 2,
            buttonY - buttonHeight / 2,
            menuX + buttonWidth / 2,
            buttonY + buttonHeight / 2
        );
        buttonGradient.addColorStop(0, '#4A90E2');
        buttonGradient.addColorStop(1, '#2C5F8D');
        ctx.fillStyle = buttonGradient;
        ctx.beginPath();
        ctx.roundRect(menuX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 22);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('RESTART', menuX, buttonY + 6);
    }
    
    gameOver() {
        gameState = 'gameOver';
        finalScoreDisplay.textContent = score;
    }
    
    reset() {
        this.player = new Player();
        this.turbines = [];
        this.obstacles = [];
        this.frameCount = 0;
        this.lastObstacleTime = 0;
        this.obstacleInterval = 2000;
        score = 0;
        gameProgress = 0;
        horizontalSpeed = 0;
        scrollOffset = 0;
        scoreDisplay.textContent = score;
        
        // Utwórz początkowe turbiny - wszystkie podstawy na ziemi, różne długości wież
        this.turbines.push(new WindTurbine(300, 120));  // Krótka wieża
        this.turbines.push(new WindTurbine(600, 180)); // Średnia wieża
        this.turbines.push(new WindTurbine(900, 150));  // Długa wieża
    }
}

// Inicjalizacja gry
const game = new Game();

// Obsługa zdarzeń
function handleInput(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    if (gameState === 'start') {
        // Sprawdź czy kliknięto w przycisk Start
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const buttonY = menuY + 20;
        const buttonWidth = 200;
        const buttonHeight = 50;
        
        // Sprawdź kolizję z przyciskiem Start
        if (x >= menuX - buttonWidth / 2 && x <= menuX + buttonWidth / 2 &&
            y >= buttonY - buttonHeight / 2 && y <= buttonY + buttonHeight / 2) {
            gameState = 'playing';
        }
    } else if (gameState === 'playing') {
        game.player.jump();
    } else if (gameState === 'gameOver') {
        // Sprawdź czy kliknięto w przycisk Restart
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const buttonY = menuY + 50;
        const buttonWidth = 180;
        const buttonHeight = 45;
        
        // Sprawdź kolizję z przyciskiem Restart
        if (x >= menuX - buttonWidth / 2 && x <= menuX + buttonWidth / 2 &&
            y >= buttonY - buttonHeight / 2 && y <= buttonY + buttonHeight / 2) {
            game.reset();
            gameState = 'playing';
        }
    }
}

// Kliknięcie na canvas
canvas.addEventListener('click', handleInput);
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (touch.clientX - rect.left) * scaleX;
        const y = (touch.clientY - rect.top) * scaleY;
        
        // Symuluj kliknięcie
        const fakeEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY
        };
        handleInput(fakeEvent);
    }
});

// Pętla gry
function gameLoop() {
    game.update();
    game.draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

