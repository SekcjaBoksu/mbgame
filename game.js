// Inicjalizacja canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
// Elementy HTML są ukryte - wszystko renderowane na canvasie
const scoreDisplay = document.getElementById('score'); // Może być null, ale nie używamy

// Ustawienia canvas - wąski ekran (jak telefon, pionowy)
function resizeCanvas() {
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;
    // Aspect ratio jak telefon (9:16 lub podobny)
    const aspectRatio = 9 / 16; // Wąski, pionowy ekran
    
    if (maxWidth / maxHeight > aspectRatio) {
        // Ekran jest szerszy niż aspect ratio - dopasuj wysokość
        canvas.height = maxHeight;
        canvas.width = maxHeight * aspectRatio;
    } else {
        // Ekran jest węższy - dopasuj szerokość
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
let isJetpackActive = false; // Czy jetpack jest aktywny
let windMomentum = 0; // Momentum wiatru - stopniowo spada po wyjściu ze smugi
const momentumDecay = 0.985; // Współczynnik spadku momentum (0.985 = spada o 1.5% co frame - spowolnione)

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
        this.gravity = 0.25; // Lżejsza grawitacja dla płynniejszego ruchu
        this.jetpackPower = -0.6; // Siła jetpacka (ujemna = w górę) - silniejsza
        this.maxUpwardSpeed = -7; // Maksymalna prędkość w górę
        this.maxDownwardSpeed = 5; // Maksymalna prędkość w dół
        this.rotation = 0;
        this.hairAnimation = 0; // Animacja włosów
    }
    
    update() {
        // Jetpack - płynne unoszenie się w górę
        if (isJetpackActive) {
            this.velocityY += this.jetpackPower;
            // Ograniczenie maksymalnej prędkości w górę
            if (this.velocityY < this.maxUpwardSpeed) {
                this.velocityY = this.maxUpwardSpeed;
            }
        } else {
            // Grawitacja - powolne opadanie
            this.velocityY += this.gravity;
            // Ograniczenie maksymalnej prędkości w dół
            if (this.velocityY > this.maxDownwardSpeed) {
                this.velocityY = this.maxDownwardSpeed;
            }
        }
        
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
        
        // Rotacja w zależności od prędkości (bardziej subtelna)
        this.rotation = Math.min(Math.max(this.velocityY * 0.08, -0.2), 0.2);
        
        // Animacja włosów - zależna od prędkości i czasu (bardziej dynamiczna)
        this.hairAnimation += 0.15 + Math.abs(this.velocityY) * 0.08;
        
        return false;
    }
    
    activateJetpack() {
        isJetpackActive = true;
    }
    
    deactivateJetpack() {
        isJetpackActive = false;
    }
    
    draw(isInWindStream = false) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        const smileIntensity = isInWindStream ? 1.0 : 0.3; // Mocny uśmiech w wietrze, lekki poza nim
        
        // Oblicz siłę wiatru dla animacji włosów
        const windStrength = isInWindStream ? 1.5 : 0.3;
        const speedStrength = Math.abs(this.velocityY) * 0.1;
        const totalWindEffect = windStrength + speedStrength;
        
        // NOGI (na dole)
        ctx.fillStyle = '#2C5F8D';
        // Lewa noga
        ctx.fillRect(-this.width / 6, this.height / 3, this.width / 6, this.height / 3);
        // Prawa noga
        ctx.fillRect(this.width / 12, this.height / 3, this.width / 6, this.height / 3);
        
        // KORPUS (tułów)
        ctx.fillStyle = '#4A90E2';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width / 2.5, this.height / 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // RAMIONA
        ctx.fillStyle = '#4A90E2';
        // Lewe ramię
        ctx.fillRect(-this.width / 2.2, -this.height / 6, this.width / 4, this.height / 4);
        // Prawe ramię
        ctx.fillRect(this.width / 2.2 - this.width / 4, -this.height / 6, this.width / 4, this.height / 4);
        
        // Logo na koszulce
        if (logoImage) {
            ctx.save();
            const logoSize = this.width * 0.35;
            ctx.drawImage(
                logoImage,
                -logoSize / 2,
                -logoSize / 3,
                logoSize,
                logoSize
            );
            ctx.restore();
        }
        
        // GŁOWA
        ctx.fillStyle = '#FFDBAC';
        ctx.beginPath();
        ctx.arc(0, -this.height / 2.5, this.width / 4, 0, Math.PI * 2);
        ctx.fill();
        
        // WŁOSY - ZAKOMENTOWANE (na razie)
        /*
        const headY = -this.height / 2.5;
        const headRadius = this.width / 4;
        
        // Główne pasmo włosów na górze głowy - bardziej widoczne i animowane
        ctx.fillStyle = '#1a1a1a'; // Kruczoczarne
        ctx.beginPath();
        const topWave = Math.sin(this.hairAnimation) * totalWindEffect;
        const topWaveY = Math.cos(this.hairAnimation * 0.8) * totalWindEffect * 0.5;
        ctx.ellipse(
            topWave * 4, // Większa animacja w poziomie
            headY - headRadius * 0.85 + topWaveY,
            headRadius * 0.65 + Math.abs(topWave) * 1.5,
            headRadius * 0.25 + Math.abs(topWaveY) * 0.5,
            0,
            0,
            Math.PI * 2
        );
        ctx.fill();
        
        // Boki głowy - pasma włosów
        ctx.fillStyle = '#0d0d0d'; // Jeszcze ciemniejsze dla głębi
        for (let i = 0; i < 6; i++) {
            const angle = (i - 3) * 0.25; // Pozycja pasma
            const wave = Math.sin(this.hairAnimation + i * 0.6) * totalWindEffect;
            const waveY = Math.cos(this.hairAnimation * 0.7 + i * 0.4) * totalWindEffect * 0.3;
            const x = Math.sin(angle) * headRadius * 0.85;
            const y = headY - headRadius * 0.6 + Math.cos(angle) * headRadius * 0.2 + waveY;
            
            ctx.beginPath();
            // Każde pasmo jako elipsa - bardziej realistyczne
            ctx.ellipse(
                x + wave * 5, // Większa animacja w poziomie
                y,
                2.5 + Math.abs(wave) * 1.5,
                4 + Math.abs(waveY) * 2,
                angle + wave * 0.3, // Rotacja zależna od wiatru
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        
        // Przednia część włosów (grzywka) - bardziej widoczna
        ctx.fillStyle = '#1a1a1a';
        for (let i = 0; i < 4; i++) {
            const offset = (i - 1.5) * 4;
            const wave = Math.sin(this.hairAnimation * 1.2 + i * 0.4) * totalWindEffect;
            const waveY = Math.cos(this.hairAnimation * 0.9 + i * 0.3) * totalWindEffect * 0.4;
            
            ctx.beginPath();
            ctx.ellipse(
                offset + wave * 3,
                headY - headRadius * 0.7 + waveY,
                2 + Math.abs(wave) * 1,
                5 + Math.abs(waveY) * 1.5,
                wave * 0.2,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        */
        
        // TWARZ - oczy
        ctx.fillStyle = '#000';
        // Lewe oko
        ctx.beginPath();
        ctx.arc(-this.width / 12, -this.height / 2.5, 2, 0, Math.PI * 2);
        ctx.fill();
        // Prawe oko
        ctx.beginPath();
        ctx.arc(this.width / 12, -this.height / 2.5, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // TWARZ - uśmiech (zależny od wiatru)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const smileY = -this.height / 2.5 + this.width / 12;
        const smileWidth = this.width / 6 * (0.5 + smileIntensity * 0.5); // Szerszy uśmiech w wietrze
        const smileHeight = this.width / 15 * smileIntensity; // Wyższy uśmiech w wietrze
        // Rysuj uśmiech jako łuk
        ctx.arc(0, smileY - smileHeight, smileWidth, 0.2, Math.PI - 0.2);
        ctx.stroke();
        
        // Jetpack - płomienie gdy aktywny
        if (isJetpackActive) {
            ctx.save();
            ctx.translate(0, this.height / 2);
            
            // Płomienie jetpacka
            const flameGradient = ctx.createLinearGradient(0, 0, 0, 25);
            flameGradient.addColorStop(0, 'rgba(255, 200, 0, 0.9)');
            flameGradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.7)');
            flameGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
            
            ctx.fillStyle = flameGradient;
            ctx.beginPath();
            // Lewy płomień
            ctx.moveTo(-this.width / 4, 0);
            ctx.lineTo(-this.width / 6, 20);
            ctx.lineTo(-this.width / 8, 25);
            ctx.lineTo(-this.width / 5, 20);
            ctx.closePath();
            ctx.fill();
            
            // Prawy płomień
            ctx.beginPath();
            ctx.moveTo(this.width / 4, 0);
            ctx.lineTo(this.width / 6, 20);
            ctx.lineTo(this.width / 8, 25);
            ctx.lineTo(this.width / 5, 20);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        
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
        this.towerHeight = towerHeight; // Wysokość wieży (różna dla każdej turbiny)
        this.towerWidth = 15;
        this.bladeLength = 60;
        this.bladeAngle = 0;
        this.bladeSpeed = -0.03; // Obroty w lewo (przeciwnie do wskazówek) - wiatr wieje w prawo (w plecy gracza)
        this.windLineLength = canvas.width * 2.0; // Długa linia wiatru od wiatraka w prawo (dla mechaniki boostu)
        this.windVisualLength = canvas.width * 0.6; // Krótsza wizualna długość smugi (dla renderowania)
    }
    
    getScreenX() {
        return this.worldX - scrollOffset;
    }
    
    getBaseY() {
        // Podstawa ZAWSZE na ziemi
        return canvas.height - groundHeight;
    }
    
    getGondolaY() {
        // Gondola na szczycie wieży (wyrasta z ziemi)
        return this.getBaseY() - this.towerHeight;
    }
    
    update() {
        this.bladeAngle += this.bladeSpeed;
    }
    
    draw() {
        const screenX = this.getScreenX();
        const baseY = this.getBaseY();
        const gondolaY = this.getGondolaY();
        
        // NAJPIERW rysuj smugę wiatru - musi być rysowana nawet gdy wiatrak jest poza ekranem
        // Linia wiatru (OD WIATRAKA W PRAWO - wiatr wieje w plecy gracza)
        const playerX = canvas.width * 0.15;
        
        // Gradient wiatru: ZACZYNA SIĘ PRZY WIATRAKU i idzie W PRAWO (na całej długości)
        // Wiatr wieje w plecy gracza, więc gradient pokazuje wiatr od wiatraka w prawo
        // Rysuj gradient nawet gdy wiatrak jest poza ekranem (po lewej stronie)
        // Sprawdź czy smuga wiatru przecina się z ekranem
        const windStartX = screenX; // Pozycja wiatraka (może być poza ekranem)
        const windEndX = screenX + this.windLineLength; // Koniec smugi wiatru (dla mechaniki)
        const windVisualEndX = screenX + this.windVisualLength; // Koniec wizualnej smugi (krótsza)
        
        // Rysuj gradient jeśli smuga wiatru przecina się z ekranem
        // Smuga jest widoczna, dopóki jakakolwiek jej część jest na ekranie
        // (windVisualEndX > 0 oznacza, że koniec wizualnej smugi jest jeszcze po prawej stronie ekranu)
        if (windVisualEndX > 0) {
            // Start gradientu - PRZY WIATRAKU (gondola) - tu wiatr jest najsilniejszy
            // Jeśli wiatrak jest poza ekranem po lewej, zacznij od 0
            const startX = Math.max(0, windStartX);
            // Koniec gradientu - w prawo od wiatraka (do końca ekranu lub do końca wizualnej smugi)
            const endX = Math.min(windVisualEndX, canvas.width);
            
            // Rysuj tylko jeśli gradient ma sens (endX > startX) i jest widoczny
            if (endX > startX) {
                // Stożkowy kształt smugi - wąski przy wiatraku, poszerza się w prawo
                const visibleWindStart = Math.max(0, windStartX);
                const visibleWindEnd = Math.min(windVisualEndX, canvas.width);
                const visibleWindLength = visibleWindEnd - visibleWindStart;
                const windProgressAtStart = (visibleWindStart - windStartX) / this.windVisualLength;
                
                // Szerokość smugi przy wiatraku (wąska)
                const startWidth = 30;
                // Szerokość smugi na końcu (szersza, rozprzestrzenia się)
                const endWidth = 120;
                
                // Oblicz aktualną szerokość na początku i końcu widocznej części
                const currentStartWidth = startWidth + (endWidth - startWidth) * windProgressAtStart * 0.3;
                const progressToEnd = (visibleWindEnd - visibleWindStart) / this.windVisualLength;
                const currentEndWidth = startWidth + (endWidth - startWidth) * (windProgressAtStart * 0.3 + progressToEnd * 0.7);
                
                // Gradient od wiatraka (silniejszy) w prawo (słabszy, zanika)
                const gradient = ctx.createLinearGradient(
                    startX,
                    gondolaY,
                    endX,
                    gondolaY
                );
                const startOpacity = Math.max(0, 1.0 - windProgressAtStart);
                gradient.addColorStop(0, `rgba(135, 206, 235, ${startOpacity * 0.6})`); // Silniejszy przy wiatraku
                gradient.addColorStop(0.3, `rgba(135, 206, 235, ${startOpacity * 0.4})`);
                gradient.addColorStop(0.6, `rgba(135, 206, 235, ${startOpacity * 0.2})`);
                gradient.addColorStop(1, 'rgba(135, 206, 235, 0)'); // Zanika w prawo
                
                ctx.fillStyle = gradient;
                
                // Rysuj stożkowy kształt (trapez) zamiast prostokąta
                ctx.beginPath();
                // Górna linia (szersza przy wiatraku, węższa na końcu)
                ctx.moveTo(startX, gondolaY - currentStartWidth / 2);
                ctx.lineTo(endX, gondolaY - currentEndWidth / 2);
                // Dolna linia
                ctx.lineTo(endX, gondolaY + currentEndWidth / 2);
                ctx.lineTo(startX, gondolaY + currentStartWidth / 2);
                ctx.closePath();
                ctx.fill();
                
                // Cząsteczki wiatru (poruszają się od wiatraka w prawo - w plecy gracza)
                ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                for (let i = 0; i < 30; i++) {
                    const progress = Math.random();
                    const offsetX = startX + (endX - startX) * progress;
                    // Rysuj tylko cząsteczki na ekranie
                    if (offsetX >= 0 && offsetX <= canvas.width) {
                        const offsetY = gondolaY + (Math.random() - 0.5) * 70;
                        const size = Math.random() * 2.5 + 1;
                        ctx.beginPath();
                        ctx.arc(offsetX, offsetY, size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
        
        // TERAZ rysuj wiatrak - tylko gdy jest na ekranie
        // Sprawdź czy wiatrak jest na ekranie
        if (screenX < -50 || screenX > canvas.width + 50) {
            return; // Nie rysuj wiatraka jeśli poza ekranem (ale smuga już została narysowana)
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
    }
    
    getWindForce(playerY) {
        // Turbina generuje siłę wiatru napędzającą gracza w prawo
        const playerX = canvas.width * 0.15;
        const screenX = this.getScreenX();
        const gondolaY = this.getGondolaY();
        
        // Wiatr wieje OD wiatraka W PRAWO (w plecy gracza)
        // Boost działa gdy MIJAMY wiatrak - czyli gdy wiatrak jest PO LEWEJ stronie gracza
        // Wiatr wieje w plecy gracza, więc gdy mijamy wiatrak (wiatrak po lewej), wiatr nas popycha
        
        // Sprawdź czy wiatrak jest po lewej stronie gracza (gdy mijamy wiatrak)
        if (screenX >= playerX - 5) {
            // Wiatrak jest po prawej stronie gracza lub przed nami - brak boostu
            return 0;
        }
        
        // Wiatrak jest po lewej stronie gracza - sprawdź czy gracz jest w prądzie powietrznym
        // Odległość od wiatraka do gracza (w prawo)
        const distanceFromTurbineToPlayer = playerX - screenX;
        const verticalDistance = Math.abs(gondolaY - playerY);
        
        // Wiatr działa gdy gracz jest w zasięgu wiatru (od wiatraka w prawo)
        // Wiatr wieje od wiatraka w prawo, więc gracz musi być w zasięgu smugi
        const maxWindDistance = this.windLineLength; // Pełna długość smugi
        
        // Sprawdź czy gracz jest w prądzie powietrznym
        // - Gracz musi być w zasięgu wiatru (distanceFromTurbineToPlayer <= maxWindDistance)
        // - Gracz musi być na odpowiedniej wysokości (verticalDistance < 60)
        const inWindStream = distanceFromTurbineToPlayer <= maxWindDistance &&
                            verticalDistance < 60;
        
        if (inWindStream) {
            // ZNACZNE przyspieszenie gdy gracz jest w prądzie powietrznym
            // Im dalej od wiatraka (większa odległość), tym słabszy wiatr (wiatr zanika)
            const distanceFactor = 1 - (distanceFromTurbineToPlayer / maxWindDistance);
            const verticalFactor = 1 - (verticalDistance / 60);
            // Maksymalne przyspieszenie: 3.5x (gdy bardzo blisko wiatraka) - ZWIĘKSZONE
            return 1.5 + (distanceFactor * verticalFactor * 2.0); // 1.5-3.5 (szybszy boost)
        }
        
        // Poza prądem powietrznym - brak wiatru z tego wiatraka
        return 0;
    }
    
    isOffScreen() {
        // Wiatrak jest usuwany dopiero gdy smuga wiatru całkowicie zniknie z ekranu
        // (nie tylko gdy sam wiatrak zniknie, ale gdy cała smuga zniknie)
        // Dodatkowy margines, aby smuga była widoczna jeszcze dłużej
        const screenX = this.getScreenX();
        const windEndX = screenX + this.windLineLength; // Koniec smugi wiatru
        const margin = canvas.width * 0.5; // Dodatkowy margines (50% szerokości ekranu)
        return windEndX + margin < 0; // Usuń dopiero gdy koniec smugi + margines zniknie z ekranu
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
        
        // Utwórz początkowe turbiny - różne wysokości wieży (podstawy zawsze na ziemi)
        const availableHeight = canvas.height - groundHeight;
        this.turbines.push(new WindTurbine(300, 100));  // Krótka wieża
        this.turbines.push(new WindTurbine(600, availableHeight * 0.5)); // Średnia wieża (50% wysokości)
        this.turbines.push(new WindTurbine(900, availableHeight * 0.7));  // Wysoka wieża (70% wysokości)
    }
    
    update() {
        if (gameState !== 'playing') return;
        
        this.frameCount++;
        
        // Oblicz prędkość poziomą na podstawie siły wiatru
        let windForce = 0;
        const playerY = this.player.y;
        
        this.turbines.forEach(turbine => {
            const force = turbine.getWindForce(playerY);
            windForce += force;
        });
        
        // Mechanika momentum - boost pozostaje po wyjściu ze smugi i stopniowo spada
        if (windForce > 0) {
            // Gdy jesteśmy w smudze, ustaw momentum na aktualną siłę wiatru (lub maksimum)
            windMomentum = Math.max(windMomentum, windForce);
        } else {
            // Gdy nie jesteśmy w smudze, momentum stopniowo spada
            windMomentum *= momentumDecay;
            // Jeśli momentum spadło poniżej minimalnej prędkości, zresetuj do zera
            if (windMomentum < 0.7) {
                windMomentum = 0;
            }
        }
        
        // Użyj maksimum z aktualnej siły wiatru i momentum
        const effectiveWindForce = Math.max(windForce, windMomentum);
        
        // Jeśli nie ma wiatru ani momentum, użyj minimalnej prędkości
        horizontalSpeed = effectiveWindForce > 0 ? effectiveWindForce : 0.7;
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
            // Różne wysokości wieży (podstawy zawsze na ziemi)
            // Wieże od 100 do 300 pikseli wysokości (różne wysokości gondoli)
            // Większe zróżnicowanie wysokości - od 80 do 70% wysokości ekranu (aby przekraczały 30%)
            const minHeight = 80;
            const maxHeight = (canvas.height - groundHeight) * 0.7; // 70% dostępnej wysokości
            const towerHeight = minHeight + Math.random() * (maxHeight - minHeight);
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
        
        // Tekstura ziemi (kamyki/ziarno) - scrolluje się w lewo (przeciwnie do scrollOffset)
        ctx.fillStyle = 'rgba(90, 74, 58, 0.3)';
        for (let i = 0; i < 20; i++) {
            const x = ((-scrollOffset * 0.5) + i * 50) % canvas.width;
            const y = groundY + 10 + Math.sin(i) * 5;
            // Upewnij się, że x jest dodatnie
            const finalX = x < 0 ? x + canvas.width : x;
            ctx.beginPath();
            ctx.arc(finalX, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Rysuj turbiny w tle
        this.turbines.forEach(turbine => turbine.draw());
        
        // Rysuj przeszkody
        this.obstacles.forEach(obstacle => obstacle.draw());
        
        // Rysuj gracza (na pierwszym planie) - tylko podczas gry
        if (gameState === 'playing') {
            // Sprawdź czy gracz jest w podmuchu wiatru
            const playerY = this.player.y;
            let isInWindStream = false;
            this.turbines.forEach(turbine => {
                const force = turbine.getWindForce(playerY);
                if (force > 0) {
                    isInWindStream = true;
                }
            });
            
            this.player.draw(isInWindStream);
            // Rysuj punkty na canvasie (tylko podczas gry)
            this.drawScore();
            // Rysuj pasek prędkości
            this.drawSpeedBar();
        }
        
        // Rysuj menu startowe na canvasie
        if (gameState === 'start') {
            this.drawStartMenu();
        }
        
        // Rysuj ekran Game Over na canvasie (na końcu, żeby był na wierzchu)
        if (gameState === 'gameOver') {
            this.drawGameOverScreen();
        }
    }
    
    drawScore() {
        // Tło dla punktów
        const scoreX = canvas.width / 2;
        const scoreY = 40;
        const scoreWidth = 180;
        const scoreHeight = 50;
        
        // Gradient tła
        const bgGradient = ctx.createLinearGradient(
            scoreX - scoreWidth / 2,
            scoreY - scoreHeight / 2,
            scoreX + scoreWidth / 2,
            scoreY + scoreHeight / 2
        );
        bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        bgGradient.addColorStop(1, 'rgba(240, 248, 255, 0.95)');
        
        // Zaokrąglony prostokąt tła
        ctx.fillStyle = bgGradient;
        ctx.beginPath();
        ctx.roundRect(scoreX - scoreWidth / 2, scoreY - scoreHeight / 2, scoreWidth, scoreHeight, 15);
        ctx.fill();
        
        // Obramowanie
        ctx.strokeStyle = 'rgba(74, 144, 226, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(scoreX - scoreWidth / 2, scoreY - scoreHeight / 2, scoreWidth, scoreHeight, 15);
        ctx.stroke();
        
        // Wewnętrzne obramowanie
        ctx.strokeStyle = 'rgba(74, 144, 226, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(scoreX - scoreWidth / 2 + 2, scoreY - scoreHeight / 2 + 2, scoreWidth - 4, scoreHeight - 4, 13);
        ctx.stroke();
        
        // Cień
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        
        // Tekst punktów
        ctx.fillStyle = '#2C5F8D';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent';
        ctx.fillText(`Punkty: ${score}`, scoreX, scoreY);
    }
    
    drawSpeedBar() {
        // Pasek prędkości - na dole ekranu, pod punktami
        const barX = canvas.width / 2;
        const barY = 80; // Pod punktami
        const barWidth = 200;
        const barHeight = 20;
        const maxSpeed = 4.0; // Maksymalna prędkość (boost może osiągnąć ~3.5)
        
        // Oblicz procent wypełnienia (od 0.7 do maxSpeed)
        const minSpeed = 0.7;
        const speedPercent = Math.min(1, Math.max(0, (horizontalSpeed - minSpeed) / (maxSpeed - minSpeed)));
        
        // Tło paska
        const bgGradient = ctx.createLinearGradient(
            barX - barWidth / 2,
            barY - barHeight / 2,
            barX + barWidth / 2,
            barY + barHeight / 2
        );
        bgGradient.addColorStop(0, 'rgba(200, 200, 200, 0.3)');
        bgGradient.addColorStop(1, 'rgba(150, 150, 150, 0.3)');
        
        ctx.fillStyle = bgGradient;
        ctx.beginPath();
        ctx.roundRect(barX - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 10);
        ctx.fill();
        
        // Wypełnienie paska (zależne od prędkości)
        const fillGradient = ctx.createLinearGradient(
            barX - barWidth / 2,
            barY - barHeight / 2,
            barX + barWidth / 2,
            barY + barHeight / 2
        );
        // Kolor zmienia się od zielonego (wolno) przez żółty (średnio) do czerwonego (szybko)
        if (speedPercent < 0.5) {
            // Zielony do żółtego
            fillGradient.addColorStop(0, '#4CAF50');
            fillGradient.addColorStop(1, '#FFC107');
        } else {
            // Żółty do czerwonego
            fillGradient.addColorStop(0, '#FFC107');
            fillGradient.addColorStop(1, '#F44336');
        }
        
        ctx.fillStyle = fillGradient;
        ctx.beginPath();
        ctx.roundRect(
            barX - barWidth / 2,
            barY - barHeight / 2,
            barWidth * speedPercent,
            barHeight,
            10
        );
        ctx.fill();
        
        // Obramowanie
        ctx.strokeStyle = 'rgba(74, 144, 226, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(barX - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 10);
        ctx.stroke();
        
        // Tekst prędkości (opcjonalnie)
        ctx.fillStyle = '#2C5F8D';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Prędkość: ${horizontalSpeed.toFixed(1)}`, barX, barY);
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
        ctx.fillText('Przytrzymaj, aby użyć jetpacka', menuX, menuY + 100);
    }
    
    drawGameOverScreen() {
        // Półprzezroczyste tło
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Tło menu
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const menuWidth = Math.min(350, canvas.width * 0.8);
        const menuHeight = 240;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(menuX - menuWidth / 2, menuY - menuHeight / 2, menuWidth, menuHeight, 20);
        ctx.fill();
        
        // Cień menu
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
        
        // Tytuł Game Over
        ctx.fillStyle = '#E2001A';
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent';
        ctx.fillText('Game Over', menuX, menuY - 70);
        
        // Wynik
        ctx.fillStyle = '#555';
        ctx.font = '22px Arial';
        ctx.fillText(`Twój wynik: ${score}`, menuX, menuY - 20);
        
        // Przycisk Restart
        const buttonY = menuY + 50;
        const buttonWidth = 200;
        const buttonHeight = 50;
        
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
        
        // Cień przycisku
        ctx.shadowColor = 'rgba(74, 144, 226, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent';
        ctx.fillText('RESTART', menuX, buttonY);
    }
    
    gameOver() {
        gameState = 'gameOver';
        isJetpackActive = false; // Wyłącz jetpack
        // Wynik jest wyświetlany na canvasie w drawGameOverScreen()
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
        isJetpackActive = false; // Reset jetpacka
        windMomentum = 0; // Reset momentum
        // Punkty są renderowane na canvasie, nie w HTML
        
        // Utwórz początkowe turbiny - różne wysokości wieży (podstawy zawsze na ziemi)
        const availableHeight = canvas.height - groundHeight;
        this.turbines.push(new WindTurbine(300, 100));  // Krótka wieża
        this.turbines.push(new WindTurbine(600, availableHeight * 0.5)); // Średnia wieża (50% wysokości)
        this.turbines.push(new WindTurbine(900, availableHeight * 0.7));  // Wysoka wieża (70% wysokości)
    }
}

// Inicjalizacja gry
const game = new Game();

// Obsługa kliknięć (tylko dla menu)
function handleClick(event) {
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
            isJetpackActive = false; // Reset jetpacka przy starcie
        }
    } else if (gameState === 'gameOver') {
        // Sprawdź czy kliknięto w przycisk Restart
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const buttonY = menuY + 50;
        const buttonWidth = 200;
        const buttonHeight = 50;
        
        // Sprawdź kolizję z przyciskiem Restart
        if (x >= menuX - buttonWidth / 2 && x <= menuX + buttonWidth / 2 &&
            y >= buttonY - buttonHeight / 2 && y <= buttonY + buttonHeight / 2) {
            game.reset();
            gameState = 'playing';
            isJetpackActive = false;
            return true; // Zwróć true żeby potwierdzić kliknięcie
        }
    }
    return false;
}

// Aktywacja jetpacka (przytrzymanie)
function activateJetpack(event) {
    if (gameState === 'playing') {
        if (event) event.preventDefault();
        isJetpackActive = true;
    }
}

// Deaktywacja jetpacka (puszczenie)
function deactivateJetpack(event) {
    if (gameState === 'playing') {
        if (event) event.preventDefault();
        isJetpackActive = false;
    }
}

// Obsługa zdarzeń myszy
canvas.addEventListener('click', handleClick);

// Mousedown - aktywuj jetpack lub obsłuż kliknięcie w menu
canvas.addEventListener('mousedown', (e) => {
    if (gameState === 'playing') {
        e.preventDefault();
        activateJetpack(e);
    } else if (gameState === 'start' || gameState === 'gameOver') {
        e.preventDefault();
        handleClick(e);
    }
});

// Mouseup - deaktywuj jetpack
canvas.addEventListener('mouseup', (e) => {
    if (gameState === 'playing') {
        e.preventDefault();
        deactivateJetpack(e);
    }
});

// Mouseleave - deaktywuj jetpack gdy mysz opuści canvas
canvas.addEventListener('mouseleave', (e) => {
    if (gameState === 'playing') {
        deactivateJetpack(e);
    }
});

// Obsługa dotyku
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'start' || gameState === 'gameOver') {
        // Dla menu - symuluj kliknięcie
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const fakeEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY
            };
            handleClick(fakeEvent);
        }
    } else if (gameState === 'playing') {
        activateJetpack(e);
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (gameState === 'playing') {
        deactivateJetpack(e);
    }
});

canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    if (gameState === 'playing') {
        deactivateJetpack(e);
    }
});

// Pętla gry
function gameLoop() {
    game.update();
    game.draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

