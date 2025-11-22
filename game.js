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
let gameState = 'start'; // 'start', 'playing', 'gameOver', 'victory'
let score = 0; // Zachowane dla kompatybilności, ale nie używane w UI
let horizontalSpeed = 0; // Prędkość pozioma kontrolowana przez wiatr
let logoImage = null;
let logoBigImage = null; // Większe logo na banery
let gameProgress = 0; // Postęp w grze (odległość przebyta)
let scrollOffset = 0; // Offset scrollowania planszy
const groundHeight = 80; // Wysokość podłoża
let isJetpackActive = false; // Czy jetpack jest aktywny
let windMomentum = 0; // Momentum wiatru - stopniowo spada po wyjściu ze smugi
const momentumDecay = 0.985; // Współczynnik spadku momentum (0.985 = spada o 1.5% co frame - spowolnione)
let introAnimationProgress = 0; // Postęp animacji intro (0-1)
const introAnimationDuration = 120; // Długość animacji w klatkach (około 2 sekundy przy 60 FPS)

// Nowe zmienne dla ścigania z czasem
const MAX_TIME = 60; // Maksymalny czas w sekundach
let gameTime = MAX_TIME; // Pozostały czas
const FINISH_LINE_DISTANCE = 7000; // Odległość do mety w pikselach (wydłużona)
let startTime = null; // Czas rozpoczęcia gry (w milisekundach)

// Załaduj logo (małe - na postaci)
const logoImg = new Image();
logoImg.src = 'logo.svg';
logoImg.onload = () => {
    logoImage = logoImg;
};

// Załaduj większe logo (na banery)
const logoBigImg = new Image();
logoBigImg.src = 'logoBig.svg';
logoBigImg.onload = () => {
    logoBigImage = logoBigImg;
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
        this.balloonPower = -0.6; // Siła balonu (ujemna = w górę) - silniejsza
        this.balloonSize = 1.0; // Rozmiar balonu (1.0 = normalny, zwiększa się gdy aktywny)
        this.maxUpwardSpeed = -7; // Maksymalna prędkość w górę
        this.maxDownwardSpeed = 5; // Maksymalna prędkość w dół
        this.rotation = 0;
    }
    
    update() {
        // Balon - płynne unoszenie się w górę
        if (isJetpackActive) { // Używamy tej samej zmiennej, ale teraz to balon
            this.velocityY += this.balloonPower;
            // Ograniczenie maksymalnej prędkości w górę
            if (this.velocityY < this.maxUpwardSpeed) {
                this.velocityY = this.maxUpwardSpeed;
            }
            // Balon się powiększa (napełnia gorącym powietrzem)
            this.balloonSize = Math.min(1.3, this.balloonSize + 0.02);
        } else {
            // Grawitacja - powolne opadanie
            this.velocityY += this.gravity;
            // Ograniczenie maksymalnej prędkości w dół
            if (this.velocityY > this.maxDownwardSpeed) {
                this.velocityY = this.maxDownwardSpeed;
            }
            // Balon się zmniejsza (opróżnia)
            this.balloonSize = Math.max(1.0, this.balloonSize - 0.02);
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
        
        return false;
    }
    
    activateJetpack() {
        isJetpackActive = true;
    }
    
    deactivateJetpack() {
        isJetpackActive = false;
    }
    
    draw(isInWindStream = false, currentSpeed = 0.7) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Uśmiech zależny od prędkości - stopniowo się zwiększa z limitem
        // Prędkość od 0.7 (minimalna) do 4.0 (maksymalna)
        const minSpeed = 0.7;
        const maxSpeed = 4.0;
        const speedPercent = Math.min(1, Math.max(0, (currentSpeed - minSpeed) / (maxSpeed - minSpeed)));
        // Uśmiech od 0.3 (wolno) do 1.0 (szybko) - z limitem
        const smileIntensity = 0.3 + (speedPercent * 0.7); // 0.3 do 1.0
        
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
        
        // TWARZ - uśmiech (zależny od prędkości)
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const smileY = -this.height / 2.5 + this.width / 12;
        const smileWidth = this.width / 6 * (0.5 + smileIntensity * 0.5); // Szerszy uśmiech w wietrze
        const smileHeight = this.width / 15 * smileIntensity; // Wyższy uśmiech w wietrze
        // Rysuj uśmiech jako łuk
        ctx.arc(0, smileY - smileHeight, smileWidth, 0.2, Math.PI - 0.2);
        ctx.stroke();
        
        // Balon na gorące powietrze - nad postacią
        const balloonRadius = (this.width * 0.8) * this.balloonSize; // Rozmiar balonu zależny od napełnienia
        const balloonY = -this.height / 2 - balloonRadius - 10; // Pozycja nad głową
        
        // Balon (okrągły, kolorowy)
        const balloonGradient = ctx.createRadialGradient(0, balloonY, 0, 0, balloonY, balloonRadius);
        balloonGradient.addColorStop(0, '#FF6B6B'); // Czerwony u góry
        balloonGradient.addColorStop(0.3, '#FF8E8E'); // Jaśniejszy czerwony
        balloonGradient.addColorStop(0.6, '#FFB3B3'); // Różowy
        balloonGradient.addColorStop(1, '#FFD4D4'); // Bardzo jasny różowy u dołu
        
        ctx.fillStyle = balloonGradient;
        ctx.beginPath();
        ctx.arc(0, balloonY, balloonRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Obramowanie balonu
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, balloonY, balloonRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Gorące powietrze (widoczne gdy balon aktywny)
        if (isJetpackActive) {
            ctx.save();
            const heatY = balloonY + balloonRadius;
            const heatGradient = ctx.createLinearGradient(0, heatY, 0, heatY + 15);
            heatGradient.addColorStop(0, 'rgba(255, 200, 0, 0.6)');
            heatGradient.addColorStop(0.5, 'rgba(255, 150, 0, 0.4)');
            heatGradient.addColorStop(1, 'rgba(255, 100, 0, 0)');
            
            ctx.fillStyle = heatGradient;
            ctx.beginPath();
            ctx.ellipse(0, heatY + 7, balloonRadius * 0.4, 15, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        // Liny łączące balon z koszem (4 linie)
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        const basketTopY = this.height / 2 + 5; // Górna część kosza
        for (let i = -1; i <= 1; i += 2) {
            ctx.beginPath();
            ctx.moveTo(i * balloonRadius * 0.3, balloonY + balloonRadius);
            ctx.lineTo(i * this.width * 0.3, basketTopY);
            ctx.stroke();
        }
        
        // Kosz (pod postacią)
        const basketWidth = this.width * 0.7;
        const basketHeight = this.height * 0.3;
        const basketY = this.height / 2;
        
        // Kosz (prostokąt z zaokrąglonymi rogami)
        ctx.fillStyle = '#8B4513'; // Brązowy kosz
        ctx.beginPath();
        ctx.roundRect(-basketWidth / 2, basketY, basketWidth, basketHeight, 3);
        ctx.fill();
        
        // Obramowanie kosza
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-basketWidth / 2, basketY, basketWidth, basketHeight, 3);
        ctx.stroke();
        
        // Wzór na koszu (poziome linie)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(-basketWidth / 2, basketY + (basketHeight / 3) * i);
            ctx.lineTo(basketWidth / 2, basketY + (basketHeight / 3) * i);
            ctx.stroke();
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
        this.towerWidth = 15; // Szerokość u góry (gondola)
        this.towerBaseWidth = 20; // Szerokość u podstawy (szersza)
        this.bladeLength = 100; // Dłuższe łopaty (zwiększone z 80)
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
                // Użyj stałej gęstości cząsteczek na jednostkę długości, nie stałej liczby
                // To zapobiega ściskaniu się cząsteczek przy krawędziach ekranu
                ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                
                // Oblicz pozycję cząsteczek w całej długości smugi (windVisualLength), nie tylko w widocznej części
                const fullWindStartX = windStartX; // Początek całej smugi (może być poza ekranem)
                const fullWindEndX = windStartX + this.windVisualLength; // Koniec całej smugi
                
                // Gęstość: 1 cząsteczka na 12-15 pikseli długości smugi
                const particleDensity = 1 / 13; // Cząsteczki na piksel
                const totalParticles = Math.ceil(this.windVisualLength * particleDensity);
                
                for (let i = 0; i < totalParticles; i++) {
                    // Pozycja w całej długości smugi (od windStartX do windVisualEndX)
                    const progress = i / totalParticles + (Math.random() - 0.5) * 0.1; // Z lekkim losowym rozrzutem
                    const particleWorldX = fullWindStartX + this.windVisualLength * progress;
                    
                    // Rysuj tylko cząsteczki, które są na ekranie
                    if (particleWorldX >= 0 && particleWorldX <= canvas.width) {
                        // Szerokość smugi w miejscu cząsteczki (interpolacja)
                        const particleProgress = progress;
                        const particleWidth = startWidth + (endWidth - startWidth) * particleProgress;
                        
                        const offsetX = particleWorldX;
                        const offsetY = gondolaY + (Math.random() - 0.5) * particleWidth * 0.6; // Rozrzut zależny od szerokości smugi
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
        
        // Wieża (biała) - trapezowa, szersza u podstawy, zwęża się do góry
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        // Rysuj trapez - szerszy u podstawy, węższy u góry
        ctx.moveTo(screenX - this.towerBaseWidth / 2, baseY); // Lewy dolny róg
        ctx.lineTo(screenX - this.towerWidth / 2, gondolaY); // Lewy górny róg
        ctx.lineTo(screenX + this.towerWidth / 2, gondolaY); // Prawy górny róg
        ctx.lineTo(screenX + this.towerBaseWidth / 2, baseY); // Prawy dolny róg
        ctx.closePath();
        ctx.fill();
        
        // Czerwony pas na wieży (około 1/4 wysokości od podstawy)
        const redBandHeight = this.towerHeight * 0.15; // Wysokość pasa
        const redBandY = baseY - (this.towerHeight * 0.25); // Pozycja pasa (1/4 od podstawy)
        // Oblicz szerokość wieży na wysokości pasa (interpolacja liniowa)
        const bandProgress = (baseY - redBandY) / this.towerHeight; // 0 = podstawa, 1 = góra
        const bandWidth = this.towerBaseWidth - (this.towerBaseWidth - this.towerWidth) * bandProgress;
        
        ctx.fillStyle = '#DC143C'; // Czerwony kolor
        ctx.fillRect(
            screenX - bandWidth / 2 - 2, // Szerzej niż wieża
            redBandY - redBandHeight / 2,
            bandWidth + 4,
            redBandHeight
        );
        
        // Łopaty (białe z czerwonymi końcówkami i pasem) - realistyczny kształt
        // Rysuj PRZED gondolą, żeby były na wierzchu
        ctx.save();
        ctx.translate(screenX, gondolaY);
        
        for (let i = 0; i < 3; i++) {
            ctx.save();
            ctx.rotate(this.bladeAngle + (i * Math.PI * 2 / 3));
            
            // Kształt łopaty - szersza przy gondoli, zwęża się do końca
            const bladeStartWidth = 10; // Szerokość przy gondoli (zwiększona z 8)
            const bladeEndWidth = 4; // Szerokość na końcu (zwiększona z 3, żeby nie było jak szpikulec)
            const bladeTipWidth = 2; // Szerokość samej końcówki (nie 0, żeby nie było jak szpikulec)
            const redTipStart = this.bladeLength * 0.8; // Czerwona końcówka zaczyna się od 80%
            const redBandStart = this.bladeLength * 0.75; // Czerwony pas zaczyna się od 75%
            const redBandEnd = this.bladeLength * 0.85; // Czerwony pas kończy się na 85%
            
            // Główna część łopaty (biała) - od gondoli do czerwonego pasa
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(-bladeStartWidth / 2, 0); // Lewy punkt przy gondoli
            ctx.lineTo(-bladeEndWidth / 2, -redTipStart); // Lewy punkt przed końcówką
            ctx.lineTo(-bladeEndWidth / 2, -redBandStart); // Lewy punkt przed pasem
            ctx.lineTo(bladeEndWidth / 2, -redBandStart); // Prawy punkt przed pasem
            ctx.lineTo(bladeEndWidth / 2, -redTipStart); // Prawy punkt przed końcówką
            ctx.lineTo(bladeStartWidth / 2, 0); // Prawy punkt przy gondoli
            ctx.closePath();
            ctx.fill();
            
            // Czerwony pas na łopacie (przed końcówką)
            ctx.fillStyle = '#DC143C';
            ctx.beginPath();
            ctx.moveTo(-bladeEndWidth / 2 - 1, -redBandStart);
            ctx.lineTo(-bladeEndWidth / 2 - 1, -redBandEnd);
            ctx.lineTo(bladeEndWidth / 2 + 1, -redBandEnd);
            ctx.lineTo(bladeEndWidth / 2 + 1, -redBandStart);
            ctx.closePath();
            ctx.fill();
            
            // Czerwona końcówka łopaty - z widoczną szerokością (nie jak szpikulec)
            ctx.fillStyle = '#DC143C';
            ctx.beginPath();
            ctx.moveTo(-bladeEndWidth / 2, -redTipStart);
            ctx.lineTo(-bladeTipWidth / 2, -this.bladeLength); // Lewy punkt końcówki (nie 0)
            ctx.lineTo(bladeTipWidth / 2, -this.bladeLength); // Prawy punkt końcówki (nie 0)
            ctx.lineTo(bladeEndWidth / 2, -redTipStart);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        
        ctx.restore();
        
        // Gondola (głowica) - jasnoszara/srebrna - rysowana PO śmigłach (w tle)
        // Okrągła gondola (nie elipsa) - delikatnie mniejsza
        const gondolaRadius = this.towerWidth * 1.0; // Okrągła, delikatnie mniejsza
        ctx.fillStyle = '#C0C0C0'; // Srebrny/jasnoszary
        ctx.beginPath();
        ctx.arc(screenX, gondolaY, gondolaRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Obramowanie gondoli dla głębi
        ctx.strokeStyle = '#A0A0A0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(screenX, gondolaY, gondolaRadius, 0, Math.PI * 2);
        ctx.stroke();
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
        this.frameCount = 0;
        scrollOffset = 0;
        
        // Gwiazdki na niebie (świąteczne)
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * (canvas.height - groundHeight),
                size: Math.random() * 2 + 1,
                brightness: Math.random() * 0.5 + 0.5, // Jasność 0.5-1.0
                twinkleSpeed: Math.random() * 0.005 + 0.003 // Wolniejsza szybkość migania
            });
        }
        
        // Góry w tle (wiele warstw - bliższe i dalsze)
        this.mountains = [];
        // Dalsze góry (wolniejszy parallax)
        for (let i = 0; i < 12; i++) {
            this.mountains.push({
                worldX: i * 250, // Pozycja w świecie
                height: Math.random() * (canvas.height - groundHeight) * 0.3 + (canvas.height - groundHeight) * 0.15, // Wysokość 15-45% ekranu
                width: Math.random() * 180 + 120, // Szerokość 120-300px
                parallaxSpeed: 0.2, // Wolniejszy parallax (dalsze)
                layer: 'far' // Warstwa dalsza
            });
        }
        // Bliższe góry (szybszy parallax)
        for (let i = 0; i < 10; i++) {
            this.mountains.push({
                worldX: i * 300, // Pozycja w świecie
                height: Math.random() * (canvas.height - groundHeight) * 0.5 + (canvas.height - groundHeight) * 0.25, // Wysokość 25-75% ekranu
                width: Math.random() * 220 + 160, // Szerokość 160-380px
                parallaxSpeed: 0.4, // Szybszy parallax (bliższe)
                layer: 'near' // Warstwa bliższa
            });
        }
        
        // Banery z logo w tle
        this.banners = [];
        for (let i = 0; i < 3; i++) {
            this.banners.push({
                worldX: (i + 1) * 1500, // Co 1500 pikseli baner
                y: (canvas.height - groundHeight) * 0.625 + Math.random() * (canvas.height - groundHeight) * 0.1875, // Niżej o 25% (62.5-81.25% ekranu zamiast 50-75%)
                width: 300, // Szerszy baner dla większego logo
                height: 120 // Wyższy baner
            });
        }
        
        // Utwórz początkowe turbiny - różne wysokości wieży (podstawy zawsze na ziemi)
        const availableHeight = canvas.height - groundHeight;
        this.turbines.push(new WindTurbine(300, 100));  // Krótka wieża
        this.turbines.push(new WindTurbine(600, availableHeight * 0.5)); // Średnia wieża (50% wysokości)
        this.turbines.push(new WindTurbine(900, availableHeight * 0.7));  // Wysoka wieża (70% wysokości)
    }
    
    update() {
        // Animacja intro - postać nadlatuje z lewej strony (tylko gdy animacja została rozpoczęta)
        if (gameState === 'start' && introAnimationProgress > 0) {
            introAnimationProgress += 1 / introAnimationDuration;
            if (introAnimationProgress >= 1) {
                introAnimationProgress = 1;
                gameState = 'playing'; // Automatycznie przejdź do gry po zakończeniu animacji
            }
            return; // Nie aktualizuj reszty gry podczas animacji
        }
        
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
        
        // Aktualizuj gwiazdki (miganie)
        this.stars.forEach(star => {
            star.brightness += star.twinkleSpeed;
            if (star.brightness > 1.0) {
                star.brightness = 0.5;
            }
        });
        
        // Dodaj nowe góry w miarę scrollowania (parallax) - różne warstwy
        // Dalsze góry
        const farMountains = this.mountains.filter(m => m.layer === 'far');
        const lastFarMountainX = farMountains.length > 0
            ? Math.max(...farMountains.map(m => m.worldX))
            : scrollOffset;
        
        if (lastFarMountainX - scrollOffset * 0.2 < canvas.width + 400) {
            const newX = Math.max(lastFarMountainX + 250, scrollOffset * 0.2 + canvas.width + 200);
            this.mountains.push({
                worldX: newX,
                height: Math.random() * (canvas.height - groundHeight) * 0.3 + (canvas.height - groundHeight) * 0.15,
                width: Math.random() * 180 + 120,
                parallaxSpeed: 0.2,
                layer: 'far'
            });
        }
        
        // Bliższe góry
        const nearMountains = this.mountains.filter(m => m.layer === 'near');
        const lastNearMountainX = nearMountains.length > 0
            ? Math.max(...nearMountains.map(m => m.worldX))
            : scrollOffset;
        
        if (lastNearMountainX - scrollOffset * 0.4 < canvas.width + 400) {
            const newX = Math.max(lastNearMountainX + 300, scrollOffset * 0.4 + canvas.width + 200);
            this.mountains.push({
                worldX: newX,
                height: Math.random() * (canvas.height - groundHeight) * 0.5 + (canvas.height - groundHeight) * 0.25,
                width: Math.random() * 220 + 160,
                parallaxSpeed: 0.4,
                layer: 'near'
            });
        }
        
        // Dodaj nowe banery w miarę scrollowania
        const lastBannerX = this.banners.length > 0
            ? Math.max(...this.banners.map(b => b.worldX))
            : scrollOffset;
        
        if (lastBannerX - scrollOffset < canvas.width + 1500) {
            const newX = Math.max(lastBannerX + 1500, scrollOffset + canvas.width + 500);
            this.banners.push({
                worldX: newX,
                y: (canvas.height - groundHeight) * 0.625 + Math.random() * (canvas.height - groundHeight) * 0.1875, // Niżej o 25% (62.5-81.25% ekranu)
                width: 300,
                height: 120
            });
        }
        
        // Usuń banery, które są daleko poza ekranem
        this.banners = this.banners.filter(banner => {
            const screenX = banner.worldX - scrollOffset;
            return screenX + banner.width > -200;
        });
        
        // Usuń góry, które są daleko poza ekranem (różne dla różnych warstw)
        this.mountains = this.mountains.filter(mountain => {
            const screenX = mountain.worldX - scrollOffset * mountain.parallaxSpeed;
            return screenX + mountain.width > -200; // Zostaw margines
        });
        
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
        
        // Aktualizuj timer (odliczanie w dół)
        if (startTime === null) {
            startTime = Date.now();
        }
        const elapsedTime = (Date.now() - startTime) / 1000; // Czas w sekundach
        gameTime = Math.max(0, MAX_TIME - elapsedTime);
        
        // Sprawdź czy czas się skończył
        if (gameTime <= 0) {
            this.gameOver();
            return;
        }
        
        // Sprawdź czy dotarliśmy do mety
        if (gameProgress >= FINISH_LINE_DISTANCE) {
            this.victory();
            return;
        }
        
        // Zwiększ wynik w zależności od postępu (zachowane dla kompatybilności)
        score = Math.floor(gameProgress / 10);
    }
    
    draw() {
        // Tło nocne (ciemne niebo) - świąteczne
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0a0e27'); // Ciemny niebieski u góry
        gradient.addColorStop(0.5, '#1a1f3a'); // Ciemny fioletowy w środku
        gradient.addColorStop(1, '#2d1b3d'); // Ciemny fioletowy przy ziemi
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Gwiazdki świecące na niebie (świąteczne) - NAJPIERW gwiazdki (w tle)
        this.stars.forEach(star => {
            // Animacja migania gwiazdek
            star.brightness += star.twinkleSpeed;
            if (star.brightness > 1.0) {
                star.brightness = 0.5;
            }
            
            // Scrollowanie gwiazdek (wolniej niż świat)
            const starX = (star.x - scrollOffset * 0.1) % canvas.width;
            const finalStarX = starX < 0 ? starX + canvas.width : starX;
            
            // Rysuj gwiazdkę
            const alpha = 0.5 + Math.sin(star.brightness * Math.PI * 2) * 0.5; // Miganie
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(finalStarX, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
            
            // Efekt świecenia (opcjonalnie - większa gwiazdka z mniejszą przezroczystością)
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(finalStarX, star.y, star.size * 2, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Góry w tle (scrollują się wolniej - parallax, różne warstwy) - PO gwiazdkach (zasłaniają je)
        // Najpierw rysuj dalsze góry (za bliższymi)
        const farMountains = this.mountains.filter(m => m.layer === 'far');
        const nearMountains = this.mountains.filter(m => m.layer === 'near');
        
        // Rysuj dalsze góry
        farMountains.forEach(mountain => {
            const screenX = mountain.worldX - scrollOffset * mountain.parallaxSpeed;
            const groundY = canvas.height - groundHeight;
            const baseY = groundY;
            const peakY = baseY - mountain.height;
            
            // Sprawdź czy góra jest widoczna
            if (screenX + mountain.width < 0 || screenX > canvas.width) {
                return; // Poza ekranem
            }
            
            // Ciemna część góry (noc) - ciemniejsza dla dalszych
            ctx.fillStyle = '#151520'; // Ciemniejszy dla dalszych
            ctx.beginPath();
            ctx.moveTo(screenX, baseY);
            ctx.lineTo(screenX + mountain.width / 2, peakY);
            ctx.lineTo(screenX + mountain.width, baseY);
            ctx.closePath();
            ctx.fill();
            
            // Delikatne cienie dla głębi
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.beginPath();
            ctx.moveTo(screenX + mountain.width * 0.6, baseY);
            ctx.lineTo(screenX + mountain.width / 2, peakY);
            ctx.lineTo(screenX + mountain.width, baseY);
            ctx.closePath();
            ctx.fill();
        });
        
        // Rysuj bliższe góry (na wierzchu)
        nearMountains.forEach(mountain => {
            const screenX = mountain.worldX - scrollOffset * mountain.parallaxSpeed;
            const groundY = canvas.height - groundHeight;
            const baseY = groundY;
            const peakY = baseY - mountain.height;
            
            // Sprawdź czy góra jest widoczna
            if (screenX + mountain.width < 0 || screenX > canvas.width) {
                return; // Poza ekranem
            }
            
            // Ciemna część góry (noc) - jaśniejsza dla bliższych
            ctx.fillStyle = '#1a1a2e'; // Jaśniejszy dla bliższych
            ctx.beginPath();
            ctx.moveTo(screenX, baseY);
            ctx.lineTo(screenX + mountain.width / 2, peakY);
            ctx.lineTo(screenX + mountain.width, baseY);
            ctx.closePath();
            ctx.fill();
            
            // Delikatne cienie dla głębi
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            ctx.moveTo(screenX + mountain.width * 0.6, baseY);
            ctx.lineTo(screenX + mountain.width / 2, peakY);
            ctx.lineTo(screenX + mountain.width, baseY);
            ctx.closePath();
            ctx.fill();
        });
        
        // Rysuj banery z logo w tle (po górach, przed śniegiem)
        this.banners.forEach(banner => {
            const screenX = banner.worldX - scrollOffset;
            const groundY = canvas.height - groundHeight;
            
            // Sprawdź czy baner jest widoczny
            if (screenX + banner.width < 0 || screenX > canvas.width) {
                return; // Poza ekranem
            }
            
            ctx.save();
            
            // Słupki po bokach (od ziemi do banera) - ciemniejsze kolory (nie przezroczystość)
            const poleWidth = 8; // Szerokość słupka
            const poleHeight = banner.y - groundY; // Wysokość od ziemi do banera
            
            // Lewy słupek (ciemniejszy szary zamiast białego)
            ctx.fillStyle = '#B0B0B0'; // Jasnoszary zamiast białego
            ctx.fillRect(screenX - poleWidth / 2, groundY, poleWidth, poleHeight);
            
            // Prawy słupek
            ctx.fillRect(screenX + banner.width - poleWidth / 2, groundY, poleWidth, poleHeight);
            
            // Tło banera (jasnoszare zamiast białego - wyciemnione)
            ctx.fillStyle = '#D0D0D0'; // Jasnoszary zamiast białego
            ctx.beginPath();
            ctx.roundRect(screenX, banner.y - banner.height / 2, banner.width, banner.height, 5);
            ctx.fill();
            
            // Ramka banera (szarawa, pasująca do koloru banera)
            ctx.strokeStyle = '#B8B8B8'; // Szarawa ramka, nieco ciemniejsza niż tło banera (#D0D0D0)
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(screenX, banner.y - banner.height / 2, banner.width, banner.height, 5);
            ctx.stroke();
            
            // Logo na banerze - zajmuje całą szerokość baneru (z małym paddingiem)
            if (logoBigImage) {
                const padding = 5; // Mały padding dookoła
                const logoWidth = banner.width - padding * 2; // Cała szerokość minus padding
                const logoHeight = banner.height - padding * 2; // Cała wysokość minus padding
                const logoX = screenX + padding;
                const logoY = banner.y - banner.height / 2 + padding;
                
                // Najpierw narysuj logo
                ctx.drawImage(logoBigImage, logoX, logoY, logoWidth, logoHeight);
                
                // Potem dodaj ciemny overlay dla efektu wyciemnienia (nie przezroczystość)
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Ciemny overlay (30% czarny) - wyciemnia bez przezroczystości
                ctx.fillRect(logoX, logoY, logoWidth, logoHeight);
            }
            
            ctx.restore();
        });
        
        // Rysuj podłoże (śnieg z teksturą)
        const groundY = canvas.height - groundHeight;
        
        // Główna część śniegu (biała z lekkim gradientem i jasnoniebieskimi akcentami)
        const snowGradient = ctx.createLinearGradient(0, groundY, 0, canvas.height);
        snowGradient.addColorStop(0, '#FFFFFF'); // Biały śnieg na górze
        snowGradient.addColorStop(0.3, '#F5F5FF'); // Lekko niebieskawy
        snowGradient.addColorStop(0.6, '#E8E8FF'); // Bardziej niebieskawy
        snowGradient.addColorStop(1, '#E0E0F0'); // Szaroniebieski na dole
        ctx.fillStyle = snowGradient;
        ctx.fillRect(0, groundY, canvas.width, groundHeight);
        
        // Tekstura śniegu - pattern z różnymi kształtami i kolorami
        // Białe płatki śniegu (różne rozmiary)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (let i = 0; i < 40; i++) {
            const x = ((-scrollOffset * 0.2) + i * 30) % canvas.width;
            const y = groundY + 10 + (i % 8) * 8 + Math.sin(i * 0.3) * 4;
            const finalX = x < 0 ? x + canvas.width : x;
            const size = Math.random() * 2 + 1;
            ctx.beginPath();
            ctx.arc(finalX, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Jasnoniebieskie akcenty (kryształki lodu)
        ctx.fillStyle = 'rgba(200, 220, 255, 0.6)';
        for (let i = 0; i < 25; i++) {
            const x = ((-scrollOffset * 0.15) + i * 50) % canvas.width;
            const y = groundY + 15 + (i % 6) * 10 + Math.cos(i * 0.4) * 5;
            const finalX = x < 0 ? x + canvas.width : x;
            const size = Math.random() * 1.5 + 0.5;
            // Małe kryształki (kwadraty/rombiki)
            ctx.fillRect(finalX - size, y - size, size * 2, size * 2);
        }
        
        // Większe płatki śniegu (gwiazdki)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        for (let i = 0; i < 15; i++) {
            const x = ((-scrollOffset * 0.25) + i * 80) % canvas.width;
            const y = groundY + 20 + (i % 5) * 12;
            const finalX = x < 0 ? x + canvas.width : x;
            const size = 2;
            // Prosta gwiazdka (4 promienie)
            ctx.save();
            ctx.translate(finalX, y);
            ctx.beginPath();
            for (let j = 0; j < 4; j++) {
                ctx.rotate(Math.PI / 2);
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -size * 2);
                ctx.moveTo(0, 0);
                ctx.lineTo(-size, -size);
                ctx.moveTo(0, 0);
                ctx.lineTo(size, -size);
            }
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }
        
        // Delikatne cienie/ciemniejsze obszary (dla głębi)
        ctx.fillStyle = 'rgba(200, 200, 220, 0.2)';
        for (let i = 0; i < 20; i++) {
            const x = ((-scrollOffset * 0.1) + i * 60) % canvas.width;
            const y = groundY + 5 + (i % 7) * 9;
            const finalX = x < 0 ? x + canvas.width : x;
            ctx.beginPath();
            ctx.arc(finalX, y, 3 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Rysuj turbiny w tle
        this.turbines.forEach(turbine => turbine.draw());
        
        // Rysuj gracza (na pierwszym planie) - podczas gry i animacji intro
        if (gameState === 'playing' || (gameState === 'start' && introAnimationProgress > 0)) {
            // Sprawdź czy gracz jest w podmuchu wiatru (tylko podczas gry)
            const playerY = this.player.y;
            let isInWindStream = false;
            if (gameState === 'playing') {
                this.turbines.forEach(turbine => {
                    const force = turbine.getWindForce(playerY);
                    if (force > 0) {
                        isInWindStream = true;
                    }
                });
            }
            
            // Podczas animacji intro, użyj animowanej pozycji X
            if (gameState === 'start' && introAnimationProgress > 0) {
                // Easing function dla płynnej animacji (ease-out)
                const easeOut = 1 - Math.pow(1 - introAnimationProgress, 3);
                const startX = -this.player.width * 2; // Poza ekranem po lewej
                const endX = canvas.width * 0.15; // Docelowa pozycja
                const animatedX = startX + (endX - startX) * easeOut;
                
                // Zapisz oryginalną pozycję X i użyj animowanej
                const originalX = this.player.x;
                this.player.x = animatedX;
                this.player.draw(false, 0); // Bez wiatru podczas animacji
                this.player.x = originalX; // Przywróć oryginalną pozycję
            } else if (gameState === 'playing') {
                this.player.draw(isInWindStream, horizontalSpeed);
                // Rysuj pasek progresu (zamiast punktów)
                this.drawProgressBar();
                // Rysuj pasek timera
                this.drawTimerBar();
                // Rysuj pasek prędkości
                this.drawSpeedBar();
            }
        }
        
        // Rysuj menu startowe na canvasie (tylko gdy animacja nie została jeszcze rozpoczęta)
        if (gameState === 'start' && introAnimationProgress === 0) {
            this.drawStartMenu();
        }
        
        // Rysuj ekran Victory (sukces) - przed Game Over
        if (gameState === 'victory') {
            this.drawVictoryScreen();
        }
        
        // Rysuj ekran Game Over na canvasie (na końcu, żeby był na wierzchu)
        if (gameState === 'gameOver') {
            this.drawGameOverScreen();
        }
    }
    
    drawProgressBar() {
        // Pasek progresu z postacią i metą
        const barX = canvas.width / 2;
        const barY = 40;
        const barWidth = canvas.width * 0.85; // 85% szerokości ekranu
        const barHeight = 50;
        
        // Oblicz postęp (0-1)
        const progress = Math.min(1, gameProgress / FINISH_LINE_DISTANCE);
        
        // Tło paska
        const bgGradient = ctx.createLinearGradient(
            barX - barWidth / 2,
            barY - barHeight / 2,
            barX + barWidth / 2,
            barY + barHeight / 2
        );
        bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        bgGradient.addColorStop(1, 'rgba(240, 248, 255, 0.95)');
        
        ctx.fillStyle = bgGradient;
        ctx.beginPath();
        ctx.roundRect(barX - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 15);
        ctx.fill();
        
        // Obramowanie
        ctx.strokeStyle = 'rgba(74, 144, 226, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(barX - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 15);
        ctx.stroke();
        
        // Linia postępu (wypełnienie pokazujące ile przebyliśmy)
        const progressWidth = (barWidth - 60) * progress; // -60 dla miejsca na postać i metę
        const progressStartX = barX - barWidth / 2 + 30; // Start po lewej (po postaci)
        
        const progressGradient = ctx.createLinearGradient(
            progressStartX,
            barY - barHeight / 2,
            progressStartX + progressWidth,
            barY + barHeight / 2
        );
        progressGradient.addColorStop(0, '#4A90E2');
        progressGradient.addColorStop(1, '#2C5F8D');
        
        ctx.fillStyle = progressGradient;
        ctx.beginPath();
        ctx.roundRect(progressStartX, barY - barHeight / 2 + 5, progressWidth, barHeight - 10, 10);
        ctx.fill();
        
        // Postać po lewej stronie paska
        const playerIconX = barX - barWidth / 2 + 15;
        const playerIconY = barY;
        const playerIconSize = 30;
        
        ctx.save();
        ctx.translate(playerIconX, playerIconY);
        // Uproszczona postać (mały balon)
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.arc(0, -8, 8, 0, Math.PI * 2);
        ctx.fill();
        // Kosz
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-5, 0, 10, 6);
        ctx.restore();
        
        // Meta po prawej stronie paska
        const finishIconX = barX + barWidth / 2 - 15;
        const finishIconY = barY;
        const finishIconSize = 30;
        
        ctx.save();
        ctx.translate(finishIconX, finishIconY);
        // Flaga mety (czarno-biała szachownica)
        ctx.fillStyle = '#000';
        ctx.fillRect(-8, -12, 16, 12);
        ctx.fillStyle = '#FFF';
        // Szachownica (2x2)
        ctx.fillRect(-8, -12, 8, 6);
        ctx.fillRect(0, -6, 8, 6);
        // Maszt
        ctx.fillStyle = '#654321';
        ctx.fillRect(-1, -12, 2, 20);
        ctx.restore();
    }
    
    drawTimerBar() {
        // Pasek timera - między paskiem odległości a paskiem prędkości
        const barX = canvas.width / 2;
        const barY = 100; // Między progress barem (40, wysokość 50) a speed barem (120)
        const barWidth = 150; // Węższy pasek
        const barHeight = 35; // Wyższy dla lepszej czytelności
        
        // Tło paska - białe, nieprzezroczyste (jak pasek progresu)
        const bgGradient = ctx.createLinearGradient(
            barX - barWidth / 2,
            barY - barHeight / 2,
            barX + barWidth / 2,
            barY + barHeight / 2
        );
        bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        bgGradient.addColorStop(1, 'rgba(240, 248, 255, 0.95)');
        
        ctx.fillStyle = bgGradient;
        ctx.beginPath();
        ctx.roundRect(barX - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 12);
        ctx.fill();
        
        // Obramowanie - niebieskie (jak pasek progresu)
        const borderColor = gameTime < 10 ? 'rgba(255, 68, 68, 0.8)' : 'rgba(74, 144, 226, 0.5)'; // Czerwony gdy mało czasu
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(barX - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 12);
        ctx.stroke();
        
        // Ikona zegarka po lewej stronie - większa
        const iconX = barX - barWidth / 2 + 20;
        const iconY = barY;
        const iconSize = 16; // Większa ikona
        
        ctx.save();
        ctx.translate(iconX, iconY);
        const iconColor = gameTime < 10 ? '#FF4444' : '#4A90E2'; // Czerwony gdy mało czasu, inaczej niebieski
        ctx.strokeStyle = iconColor;
        ctx.fillStyle = iconColor;
        ctx.lineWidth = 2;
        
        // Okrąg zegarka
        ctx.beginPath();
        ctx.arc(0, 0, iconSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        
        // Wskazówki zegarka (12:00)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -iconSize / 3); // Długa wskazówka (minutowa)
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(iconSize / 4, 0); // Krótka wskazówka (godzinowa)
        ctx.stroke();
        
        ctx.restore();
        
        // Tekst z czasem - wyśrodkowany, większa czcionka
        const timeColor = gameTime < 10 ? '#FF4444' : '#2C5F8D'; // Czerwony gdy mało czasu
        ctx.fillStyle = timeColor;
        ctx.font = 'bold 24px Arial'; // Większa czcionka
        ctx.textAlign = 'center'; // Wyśrodkowany
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(gameTime)}s`, barX, barY);
    }
    
    drawSpeedBar() {
        // Pasek prędkości - na dole ekranu, pod punktami
        const barX = canvas.width / 2;
        const barY = 130; // Pod timer barem (100, wysokość 20)
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
        
        // Tekst prędkości
        ctx.fillStyle = '#2C5F8D';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Geschwindigkeit', barX, barY);
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
        ctx.fillText('Nutze die Windkraft zum Fliegen!', menuX, menuY - 30);
        
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
        ctx.fillText('Halten, um den Ballon zu füllen', menuX, menuY + 100);
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
        ctx.fillText(`Dein Ergebnis: ${score}`, menuX, menuY - 20);
        
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
    
    drawVictoryScreen() {
        // Półprzezroczyste tło
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Tło menu
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const menuWidth = Math.min(350, canvas.width * 0.8);
        const menuHeight = 280;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(menuX - menuWidth / 2, menuY - menuHeight / 2, menuWidth, menuHeight, 20);
        ctx.fill();
        
        // Cień menu
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
        
        // Tytuł - Sukces!
        ctx.fillStyle = '#4CAF50'; // Zielony dla sukcesu
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent';
        ctx.fillText('Erfolg!', menuX, menuY - 70);
        
        // Czas ukończenia
        const finishTime = MAX_TIME - gameTime;
        ctx.fillStyle = '#555';
        ctx.font = '22px Arial';
        ctx.fillText(`Zeit: ${finishTime.toFixed(1)}s`, menuX, menuY - 20);
        
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
    
    victory() {
        gameState = 'victory';
        isJetpackActive = false; // Wyłącz jetpack
        // Czas ukończenia jest wyświetlany na canvasie w drawVictoryScreen()
    }
    
    reset() {
        this.player = new Player();
        this.turbines = [];
        this.frameCount = 0;
        score = 0;
        gameProgress = 0;
        horizontalSpeed = 0;
        scrollOffset = 0;
        isJetpackActive = false; // Reset jetpacka
        windMomentum = 0; // Reset momentum
        introAnimationProgress = 0; // Reset animacji intro
        gameTime = MAX_TIME; // Reset timera
        startTime = null; // Reset czasu rozpoczęcia
        // Punkty są renderowane na canvasie, nie w HTML
        
        // Reset gwiazdek
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * (canvas.height - groundHeight),
                size: Math.random() * 2 + 1,
                brightness: Math.random() * 0.5 + 0.5,
                twinkleSpeed: Math.random() * 0.005 + 0.003 // Wolniejsza szybkość migania
            });
        }
        
        // Reset gór w tle (wiele warstw - bliższe i dalsze)
        this.mountains = [];
        // Dalsze góry (wolniejszy parallax)
        for (let i = 0; i < 12; i++) {
            this.mountains.push({
                worldX: i * 250,
                height: Math.random() * (canvas.height - groundHeight) * 0.3 + (canvas.height - groundHeight) * 0.15,
                width: Math.random() * 180 + 120,
                parallaxSpeed: 0.2,
                layer: 'far'
            });
        }
        // Bliższe góry (szybszy parallax)
        for (let i = 0; i < 10; i++) {
            this.mountains.push({
                worldX: i * 300,
                height: Math.random() * (canvas.height - groundHeight) * 0.5 + (canvas.height - groundHeight) * 0.25,
                width: Math.random() * 220 + 160,
                parallaxSpeed: 0.4,
                layer: 'near'
            });
        }
        
        // Reset banerów z logo
        this.banners = [];
        for (let i = 0; i < 3; i++) {
            this.banners.push({
                worldX: (i + 1) * 1500,
                y: (canvas.height - groundHeight) * 0.625 + Math.random() * (canvas.height - groundHeight) * 0.1875, // Niżej o 25% (62.5-81.25% ekranu)
                width: 300,
                height: 120
            });
        }
        
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
        // Podczas animacji intro nie można kliknąć Start
        if (introAnimationProgress < 0.1) {
            // Sprawdź czy kliknięto w przycisk Start
            const menuX = canvas.width / 2;
            const menuY = canvas.height / 2;
            const buttonY = menuY + 20;
            const buttonWidth = 200;
            const buttonHeight = 50;
            
            // Sprawdź kolizję z przyciskiem Start
            if (x >= menuX - buttonWidth / 2 && x <= menuX + buttonWidth / 2 &&
                y >= buttonY - buttonHeight / 2 && y <= buttonY + buttonHeight / 2) {
                introAnimationProgress = 0.001; // Rozpocznij animację (mała wartość, żeby animacja się rozpoczęła)
            }
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
            gameState = 'start'; // Wróć do stanu start z animacją
            introAnimationProgress = 0.001; // Rozpocznij animację intro
            isJetpackActive = false;
            return true; // Zwróć true żeby potwierdzić kliknięcie
        }
    } else if (gameState === 'victory') {
        // Sprawdź czy kliknięto w przycisk Restart (dla ekranu Victory)
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const buttonY = menuY + 50;
        const buttonWidth = 200;
        const buttonHeight = 50;
        
        // Sprawdź kolizję z przyciskiem Restart
        if (x >= menuX - buttonWidth / 2 && x <= menuX + buttonWidth / 2 &&
            y >= buttonY - buttonHeight / 2 && y <= buttonY + buttonHeight / 2) {
            game.reset();
            gameState = 'start'; // Wróć do stanu start z animacją
            introAnimationProgress = 0.001; // Rozpocznij animację intro
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
    } else if (gameState === 'start' || gameState === 'gameOver' || gameState === 'victory') {
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

