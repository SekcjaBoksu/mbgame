const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreDisplay = document.getElementById('score');

function resizeCanvas() {
    const maxWidth = window.innerWidth;
    const maxHeight = window.innerHeight;
    const aspectRatio = 9 / 16;
    
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

let gameState = 'start';
let score = 0;
let horizontalSpeed = 0;
let logoImage = null;
let logoBigImage = null;
let gameProgress = 0;
let scrollOffset = 0;
const groundHeight = 80;
let isJetpackActive = false;
let windMomentum = 0;
const momentumDecay = 0.985;
let introAnimationProgress = 0;
const introAnimationDuration = 120;
let crashAnimationProgress = 0;
const crashAnimationDuration = 90;
let isCrashing = false;
let crashBounceVelocity = 0;
let crashParticles = [];

let fireworks = [];
let fireworksTimer = 0;

const MAX_TIME = 60;
let gameTime = MAX_TIME;
const FINISH_LINE_DISTANCE = 7000;
let startTime = null;

const logoImg = new Image();
logoImg.src = 'logo.svg';
logoImg.onload = () => {
    logoImage = logoImg;
};

const logoBigImg = new Image();
logoBigImg.src = 'logoBig.svg';
logoBigImg.onload = () => {
    logoBigImage = logoBigImg;
};

class Player {
    constructor() {
        this.width = 60;
        this.height = 60;
        this.x = canvas.width * 0.15;
        this.y = canvas.height / 2;
        this.velocityY = 0;
        this.gravity = 0.25;
        this.balloonPower = -0.6;
        this.balloonSize = 1.0;
        this.maxUpwardSpeed = -7;
        this.maxDownwardSpeed = 5;
        this.rotation = 0;
    }
    
    update() {
        if (isJetpackActive) {
            this.velocityY += this.balloonPower;
            if (this.velocityY < this.maxUpwardSpeed) {
                this.velocityY = this.maxUpwardSpeed;
            }
            this.balloonSize = Math.min(1.3, this.balloonSize + 0.02);
        } else {
            this.velocityY += this.gravity;
            if (this.velocityY > this.maxDownwardSpeed) {
                this.velocityY = this.maxDownwardSpeed;
            }
            this.balloonSize = Math.max(1.0, this.balloonSize - 0.02);
        }
        
        this.y += this.velocityY;
        
        if (this.y < this.height / 2) {
            this.y = this.height / 2;
            this.velocityY = 0;
        }
        
        const groundY = canvas.height - groundHeight;
        if (this.y + this.height / 2 > groundY) {
            return true;
        }
        
        this.rotation = Math.min(Math.max(this.velocityY * 0.08, -0.2), 0.2);
        
        return false;
    }
    
    activateJetpack() {
        isJetpackActive = true;
    }
    
    deactivateJetpack() {
        isJetpackActive = false;
    }
    
    draw(isInWindStream = false, currentSpeed = 0.7, isCrashMode = false) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        const minSpeed = 0.7;
        const maxSpeed = 4.0;
        const speedPercent = Math.min(1, Math.max(0, (currentSpeed - minSpeed) / (maxSpeed - minSpeed)));
        const smileIntensity = 0.3 + (speedPercent * 0.7);
        
        const torsoTopWidth = this.width / 1.8;
        
        const torsoHeight = this.height / 2.2;
        const torsoTopY = -torsoHeight / 2;
        
        const neckY = -this.height / 3.5;
        const torsoBottomY = torsoHeight / 2;
        const legHeight = this.height / 3;
        const legStartY = torsoBottomY + 3;
        const legMidY = legStartY + legHeight / 2;
        
        const capeLength = legMidY - neckY;
        const capeTopWidth = this.width * 0.4;
        const capeBottomWidth = this.width * 0.7;
        
        const windForce = Math.max(0, currentSpeed - 0.7) * 0.5;
        const capeAngle = Math.sin(Date.now() * 0.005) * windForce * 0.3;
        
        ctx.fillStyle = '#DC143C';
        ctx.beginPath();
        ctx.moveTo(0, neckY);
        ctx.lineTo(-capeTopWidth / 2, neckY);
        ctx.lineTo(-capeBottomWidth / 2 + capeAngle * capeLength, neckY + capeLength);
        ctx.lineTo(capeBottomWidth / 2 + capeAngle * capeLength, neckY + capeLength);
        ctx.lineTo(capeTopWidth / 2, neckY);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#4A90E2';
        ctx.beginPath();
        const torsoBottomWidth = this.width / 2.8;
        
        ctx.fillStyle = '#3A6FA2';
        const legWidth = torsoBottomWidth / 2.5;
        ctx.fillRect(-torsoBottomWidth / 2 + (torsoBottomWidth - legWidth * 2) / 3, legStartY, legWidth, legHeight);
        ctx.fillRect(torsoBottomWidth / 2 - (torsoBottomWidth - legWidth * 2) / 3 - legWidth, legStartY, legWidth, legHeight);
        
        ctx.moveTo(-torsoTopWidth / 2, torsoTopY);
        ctx.lineTo(torsoTopWidth / 2, torsoTopY);
        ctx.lineTo(torsoBottomWidth / 2, torsoBottomY);
        ctx.lineTo(-torsoBottomWidth / 2, torsoBottomY);
        ctx.closePath();
        ctx.fill();
        
        const beltWidth = torsoBottomWidth * 1.1;
        const beltHeight = 5;
        const beltY = torsoBottomY + 1;
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(-beltWidth / 2, beltY, beltWidth, beltHeight);
        
        ctx.fillStyle = '#FFD700';
        const buckleWidth = 8;
        const buckleHeight = beltHeight - 1;
        ctx.fillRect(-buckleWidth / 2, beltY + 0.5, buckleWidth, buckleHeight);
        
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-buckleWidth / 2, beltY + beltHeight / 2);
        ctx.lineTo(buckleWidth / 2, beltY + beltHeight / 2);
        ctx.stroke();
        
        const balloonRadius = (this.width * 0.8) * this.balloonSize;
        const balloonY = -this.height / 2 - balloonRadius - 30;
        const basketTopY = this.height / 2 + 5;
        
        const handY = -this.height / 12;
        const leftHandX = -this.width * 0.3;
        const rightHandX = this.width * 0.3;
        
        ctx.fillStyle = '#4A90E2';
        const leftArmStartX = -torsoTopWidth / 2;
        const leftArmStartY = -this.height / 8;
        const leftArmEndX = leftHandX;
        const leftArmEndY = handY;
        const leftArmLength = Math.sqrt(
            Math.pow(leftArmEndX - leftArmStartX, 2) + 
            Math.pow(leftArmEndY - leftArmStartY, 2)
        );
        ctx.save();
        ctx.translate(leftArmStartX, leftArmStartY);
        const leftArmAngle = Math.atan2(leftArmEndY - leftArmStartY, leftArmEndX - leftArmStartX);
        ctx.rotate(leftArmAngle);
        ctx.fillRect(0, -this.width / 8, leftArmLength, this.width / 4);
        ctx.restore();
        
        const rightArmStartX = torsoTopWidth / 2;
        const rightArmStartY = -this.height / 8;
        const rightArmEndX = rightHandX;
        const rightArmEndY = handY;
        const rightArmLength = Math.sqrt(
            Math.pow(rightArmEndX - rightArmStartX, 2) + 
            Math.pow(rightArmEndY - rightArmStartY, 2)
        );
        ctx.save();
        ctx.translate(rightArmStartX, rightArmStartY);
        const rightArmAngle = Math.atan2(rightArmEndY - rightArmStartY, rightArmEndX - rightArmStartX);
        ctx.rotate(rightArmAngle);
        ctx.fillRect(0, -this.width / 8, rightArmLength, this.width / 4);
        ctx.restore();
        
        if (logoImage) {
            ctx.save();
            const logoSize = this.width * 0.32;
            ctx.drawImage(
                logoImage,
                -logoSize / 2,
                -logoSize / 4,
                logoSize,
                logoSize
            );
            ctx.restore();
        }
        
        ctx.fillStyle = '#FFDBAC';
        ctx.beginPath();
        ctx.arc(0, -this.height / 2.5, this.width / 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-this.width / 12, -this.height / 2.5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.width / 12, -this.height / 2.5, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const smileY = -this.height / 2.5 + this.width / 12;
        const smileWidth = this.width / 6 * (0.5 + smileIntensity * 0.5);
        const smileHeight = this.width / 15 * smileIntensity;
        ctx.arc(0, smileY - smileHeight, smileWidth, 0.2, Math.PI - 0.2);
        ctx.stroke();
        
        const headCenterY = -this.height / 2.5;
        const headRadius = this.width / 4;
        const hatWidth = headRadius * 1.8;
        const hatHeight = headRadius * 0.9;
        const hatOffset = headRadius * 0.2;
        const hatBaseY = headCenterY - headRadius + hatOffset;
        const hatTopY = hatBaseY - hatHeight;
        
        ctx.fillStyle = '#DC143C';
        ctx.beginPath();
        ctx.moveTo(0, hatTopY);
        ctx.lineTo(-hatWidth / 2, hatBaseY);
        ctx.lineTo(hatWidth / 2, hatBaseY);
        ctx.closePath();
        ctx.fill();
        
        const brimHeight = headRadius * 0.12;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-hatWidth / 2, hatBaseY, hatWidth, brimHeight);
        
        const pomponRadius = headRadius * 0.2;
        const pomponX = 0;
        const pomponY = hatTopY;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(pomponX, pomponY, pomponRadius, 0, Math.PI * 2);
        ctx.fill();
        
        const pomponGradient = ctx.createRadialGradient(
            pomponX - pomponRadius * 0.3,
            pomponY - pomponRadius * 0.3,
            0,
            pomponX,
            pomponY,
            pomponRadius
        );
        pomponGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        pomponGradient.addColorStop(1, 'rgba(240, 240, 240, 0.7)');
        ctx.fillStyle = pomponGradient;
        ctx.beginPath();
        ctx.arc(pomponX, pomponY, pomponRadius, 0, Math.PI * 2);
        ctx.fill();
        
        
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
        
        if (!isCrashMode || this.balloonSize > 0) {
            const balloonGradient = ctx.createRadialGradient(0, balloonY, 0, 0, balloonY, balloonRadius);
            balloonGradient.addColorStop(0, '#8B0000');
            balloonGradient.addColorStop(0.3, '#B22222');
            balloonGradient.addColorStop(0.6, '#DC143C');
            balloonGradient.addColorStop(1, '#FF4444');
            
            ctx.fillStyle = balloonGradient;
            ctx.beginPath();
            ctx.arc(0, balloonY, balloonRadius, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#FF4444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, balloonY, balloonRadius, 0, Math.PI * 2);
            ctx.stroke();
            
        }
        
        if (!isCrashMode || this.balloonSize > 0.2) {
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 2;
            for (let i = -1; i <= 1; i += 2) {
                ctx.beginPath();
                ctx.moveTo(i * balloonRadius * 0.3, balloonY + balloonRadius);
                ctx.lineTo(i * this.width * 0.3, basketTopY);
                ctx.stroke();
            }
        }
        
        ctx.fillStyle = '#FFDBAC';
        const handRadius = this.width / 12;
        ctx.beginPath();
        ctx.arc(leftHandX, handY, handRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rightHandX, handY, handRadius, 0, Math.PI * 2);
        ctx.fill();
        
        const basketWidth = this.width * 0.7;
        const basketHeight = this.height * 0.3;
        const basketY = this.height / 2;
        
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.roundRect(-basketWidth / 2, basketY, basketWidth, basketHeight, 3);
        ctx.fill();
        
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-basketWidth / 2, basketY, basketWidth, basketHeight, 3);
        ctx.stroke();
        
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

class WindTurbine {
    constructor(worldX, towerHeight) {
        this.worldX = worldX;
        this.towerHeight = towerHeight;
        this.towerWidth = 15;
        this.towerBaseWidth = 20;
        this.bladeLength = 100;
        this.bladeAngle = 0;
        this.bladeSpeed = -0.03;
        this.windLineLength = canvas.width * 2.0;
        this.windVisualLength = canvas.width * 0.6;
    }
    
    getScreenX() {
        return this.worldX - scrollOffset;
    }
    
    getBaseY() {
        return canvas.height - groundHeight;
    }
    
    getGondolaY() {
        return this.getBaseY() - this.towerHeight;
    }
    
    update() {
        this.bladeAngle += this.bladeSpeed;
    }
    
    draw() {
        const screenX = this.getScreenX();
        const baseY = this.getBaseY();
        const gondolaY = this.getGondolaY();
        
        const playerX = canvas.width * 0.15;
        
        const windStartX = screenX;
        const windEndX = screenX + this.windLineLength;
        const windVisualEndX = screenX + this.windVisualLength;
        
        if (windVisualEndX > 0) {
            const startX = Math.max(0, windStartX);
            const endX = Math.min(windVisualEndX, canvas.width);
            
            if (endX > startX) {
                const visibleWindStart = Math.max(0, windStartX);
                const visibleWindEnd = Math.min(windVisualEndX, canvas.width);
                const visibleWindLength = visibleWindEnd - visibleWindStart;
                const windProgressAtStart = (visibleWindStart - windStartX) / this.windVisualLength;
                
                const startWidth = 30;
                const endWidth = 120;
                
                const currentStartWidth = startWidth + (endWidth - startWidth) * windProgressAtStart * 0.3;
                const progressToEnd = (visibleWindEnd - visibleWindStart) / this.windVisualLength;
                const currentEndWidth = startWidth + (endWidth - startWidth) * (windProgressAtStart * 0.3 + progressToEnd * 0.7);
                
                const gradient = ctx.createLinearGradient(
                    startX,
                    gondolaY,
                    endX,
                    gondolaY
                );
                const startOpacity = Math.max(0, 1.0 - windProgressAtStart);
                gradient.addColorStop(0, `rgba(135, 206, 235, ${startOpacity * 0.6})`);
                gradient.addColorStop(0.3, `rgba(135, 206, 235, ${startOpacity * 0.4})`);
                gradient.addColorStop(0.6, `rgba(135, 206, 235, ${startOpacity * 0.2})`);
                gradient.addColorStop(1, 'rgba(135, 206, 235, 0)');
                
                ctx.fillStyle = gradient;
                
                ctx.beginPath();
                ctx.moveTo(startX, gondolaY - currentStartWidth / 2);
                ctx.lineTo(endX, gondolaY - currentEndWidth / 2);
                ctx.lineTo(endX, gondolaY + currentEndWidth / 2);
                ctx.lineTo(startX, gondolaY + currentStartWidth / 2);
                ctx.closePath();
                ctx.fill();
                
                ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                
                const fullWindStartX = windStartX;
                const fullWindEndX = windStartX + this.windVisualLength;
                
                const particleDensity = 1 / 13;
                const totalParticles = Math.ceil(this.windVisualLength * particleDensity);
                
                for (let i = 0; i < totalParticles; i++) {
                    const progress = i / totalParticles + (Math.random() - 0.5) * 0.1;
                    const particleWorldX = fullWindStartX + this.windVisualLength * progress;
                    
                    if (particleWorldX >= 0 && particleWorldX <= canvas.width) {
                        const particleProgress = progress;
                        const particleWidth = startWidth + (endWidth - startWidth) * particleProgress;
                        
                        const offsetX = particleWorldX;
                        const offsetY = gondolaY + (Math.random() - 0.5) * particleWidth * 0.6;
                        const size = Math.random() * 2.5 + 1;
                        ctx.beginPath();
                        ctx.arc(offsetX, offsetY, size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
        
        if (screenX < -50 || screenX > canvas.width + 50) {
            return;
        }
        
        if (gondolaY < -100) {
            return;
        }
        
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(screenX - this.towerBaseWidth / 2, baseY);
        ctx.lineTo(screenX - this.towerWidth / 2, gondolaY);
        ctx.lineTo(screenX + this.towerWidth / 2, gondolaY);
        ctx.lineTo(screenX + this.towerBaseWidth / 2, baseY);
        ctx.closePath();
        ctx.fill();
        
        const redBandHeight = this.towerHeight * 0.15;
        const redBandY = baseY - (this.towerHeight * 0.25);
        const bandProgress = (baseY - redBandY) / this.towerHeight;
        const bandWidth = this.towerBaseWidth - (this.towerBaseWidth - this.towerWidth) * bandProgress;
        
        ctx.fillStyle = '#DC143C';
        ctx.fillRect(
            screenX - bandWidth / 2 - 2,
            redBandY - redBandHeight / 2,
            bandWidth + 4,
            redBandHeight
        );
        
        ctx.save();
        ctx.translate(screenX, gondolaY);
        
        for (let i = 0; i < 3; i++) {
            ctx.save();
            ctx.rotate(this.bladeAngle + (i * Math.PI * 2 / 3));
            
            const bladeStartWidth = 10;
            const bladeEndWidth = 4;
            const bladeTipWidth = 2;
            const redTipStart = this.bladeLength * 0.8;
            const redBandStart = this.bladeLength * 0.75;
            const redBandEnd = this.bladeLength * 0.85;
            
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(-bladeStartWidth / 2, 0);
            ctx.lineTo(-bladeEndWidth / 2, -redTipStart);
            ctx.lineTo(-bladeEndWidth / 2, -redBandStart);
            ctx.lineTo(bladeEndWidth / 2, -redBandStart);
            ctx.lineTo(bladeEndWidth / 2, -redTipStart);
            ctx.lineTo(bladeStartWidth / 2, 0);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = '#DC143C';
            ctx.beginPath();
            ctx.moveTo(-bladeEndWidth / 2 - 1, -redBandStart);
            ctx.lineTo(-bladeEndWidth / 2 - 1, -redBandEnd);
            ctx.lineTo(bladeEndWidth / 2 + 1, -redBandEnd);
            ctx.lineTo(bladeEndWidth / 2 + 1, -redBandStart);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = '#DC143C';
            ctx.beginPath();
            ctx.moveTo(-bladeEndWidth / 2, -redTipStart);
            ctx.lineTo(-bladeTipWidth / 2, -this.bladeLength);
            ctx.lineTo(bladeTipWidth / 2, -this.bladeLength);
            ctx.lineTo(bladeEndWidth / 2, -redTipStart);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        
        ctx.restore();
        
        const gondolaRadius = this.towerWidth * 1.0;
        ctx.fillStyle = '#C0C0C0';
        ctx.beginPath();
        ctx.arc(screenX, gondolaY, gondolaRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#A0A0A0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(screenX, gondolaY, gondolaRadius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    getWindForce(playerY) {
        const playerX = canvas.width * 0.15;
        const screenX = this.getScreenX();
        const gondolaY = this.getGondolaY();
        
        
        if (screenX >= playerX - 5) {
            return 0;
        }
        
        const distanceFromTurbineToPlayer = playerX - screenX;
        const verticalDistance = Math.abs(gondolaY - playerY);
        
        const maxWindDistance = this.windLineLength;
        
        const inWindStream = distanceFromTurbineToPlayer <= maxWindDistance &&
                            verticalDistance < 60;
        
        if (inWindStream) {
            const distanceFactor = 1 - (distanceFromTurbineToPlayer / maxWindDistance);
            const verticalFactor = 1 - (verticalDistance / 60);
            return 1.5 + (distanceFactor * verticalFactor * 2.0);
        }
        
        return 0;
    }
    
    isOffScreen() {
        const screenX = this.getScreenX();
        const windEndX = screenX + this.windLineLength;
        const margin = canvas.width * 0.5;
        return windEndX + margin < 0;
    }
}

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

function checkCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

class Game {
    constructor() {
        this.player = new Player();
        this.turbines = [];
        this.frameCount = 0;
        scrollOffset = 0;
        
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * (canvas.height - groundHeight),
                size: Math.random() * 2 + 1,
                brightness: Math.random() * 0.5 + 0.5,
                twinkleSpeed: Math.random() * 0.005 + 0.003
            });
        }
        
        this.mountains = [];
        for (let i = 0; i < 12; i++) {
            this.mountains.push({
                worldX: i * 250,
                height: Math.random() * (canvas.height - groundHeight) * 0.3 + (canvas.height - groundHeight) * 0.15,
                width: Math.random() * 180 + 120,
                parallaxSpeed: 0.2,
                layer: 'far'
            });
        }
        for (let i = 0; i < 10; i++) {
            this.mountains.push({
                worldX: i * 300,
                height: Math.random() * (canvas.height - groundHeight) * 0.5 + (canvas.height - groundHeight) * 0.25,
                width: Math.random() * 220 + 160,
                parallaxSpeed: 0.4,
                layer: 'near'
            });
        }
        
        this.banners = [];
        for (let i = 0; i < 3; i++) {
            this.banners.push({
                worldX: (i + 1) * 1500,
                y: (canvas.height - groundHeight) * 0.625 + Math.random() * (canvas.height - groundHeight) * 0.1875,
                width: 300,
                height: 120
            });
        }
        
        const availableHeight = canvas.height - groundHeight;
        this.turbines.push(new WindTurbine(300, 100));
        this.turbines.push(new WindTurbine(600, availableHeight * 0.5));
        this.turbines.push(new WindTurbine(900, availableHeight * 0.7));
    }
    
    update() {
        this.frameCount++;
        
        this.turbines.forEach(turbine => turbine.update());
        
        if (gameState === 'start' && introAnimationProgress > 0) {
            introAnimationProgress += 1 / introAnimationDuration;
            if (introAnimationProgress >= 1) {
                introAnimationProgress = 1;
                gameState = 'playing';
            }
            return;
        }
        
        if (gameState === 'victory') {
            fireworksTimer++;
            
            if (fireworksTimer % 10 === 0) {
                const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#FF1493'];
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height * 0.5;
                
                for (let i = 0; i < 50; i++) {
                    const angle = (Math.PI * 2 * i) / 50;
                    const speed = 3 + Math.random() * 5;
                    fireworks.push({
                        x: x,
                        y: y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        color: colors[Math.floor(Math.random() * colors.length)],
                        size: 4 + Math.random() * 4,
                        life: 1.0,
                        decay: 0.01 + Math.random() * 0.008
                    });
                }
            }
            
            fireworks = fireworks.filter(firework => {
                firework.x += firework.vx;
                firework.y += firework.vy;
                firework.vy += 0.1;
                firework.life -= firework.decay;
                return firework.life > 0 && firework.y < canvas.height + 50;
            });
            
            return;
        }
        
        if (gameState !== 'playing') return;
        
        let windForce = 0;
        const playerY = this.player.y;
        
        this.turbines.forEach(turbine => {
            const force = turbine.getWindForce(playerY);
            windForce += force;
        });
        
        if (windForce > 0) {
            windMomentum = Math.max(windMomentum, windForce);
        } else {
            windMomentum *= momentumDecay;
            if (windMomentum < 0.7) {
                windMomentum = 0;
            }
        }
        
        const effectiveWindForce = Math.max(windForce, windMomentum);
        
        horizontalSpeed = effectiveWindForce > 0 ? effectiveWindForce : 0.7;
        gameProgress += horizontalSpeed;
        
        scrollOffset += horizontalSpeed;
        
        const hitGround = this.player.update();
        if (hitGround && !isCrashing) {
            isCrashing = true;
            crashAnimationProgress = 0;
            
            const groundY = canvas.height - groundHeight;
            const crashX = this.player.x;
            const crashY = groundY;
            
            for (let i = 0; i < 30; i++) {
                crashParticles.push({
                    x: crashX + (Math.random() - 0.5) * 40,
                    y: crashY,
                    vx: (Math.random() - 0.5) * 4,
                    vy: -Math.random() * 6 - 2,
                    size: Math.random() * 4 + 2,
                    life: 1.0,
                    decay: Math.random() * 0.02 + 0.015
                });
            }
        }
        
        if (isCrashing) {
            crashAnimationProgress += 1 / crashAnimationDuration;
            horizontalSpeed = 0;
            
            const groundY = canvas.height - groundHeight;
            this.player.y = groundY - this.player.height / 2;
            
            crashParticles = crashParticles.filter(particle => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                
                particle.vy += 0.15;
                
                particle.life -= particle.decay;
                
                return particle.life > 0 && particle.y < canvas.height + 50;
            });
            
            if (crashAnimationProgress >= 1) {
                this.gameOver();
                return;
            }
        }
        
        if (gameState === 'playing') {
            this.turbines = this.turbines.filter(turbine => !turbine.isOffScreen());
        }
        
        this.stars.forEach(star => {
            star.brightness += star.twinkleSpeed;
            if (star.brightness > 1.0) {
                star.brightness = 0.5;
            }
        });
        
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
        
        const lastBannerX = this.banners.length > 0
            ? Math.max(...this.banners.map(b => b.worldX))
            : scrollOffset;
        
        if (lastBannerX - scrollOffset < canvas.width + 1500) {
            const newX = Math.max(lastBannerX + 1500, scrollOffset + canvas.width + 500);
            this.banners.push({
                worldX: newX,
                y: (canvas.height - groundHeight) * 0.625 + Math.random() * (canvas.height - groundHeight) * 0.1875,
                width: 300,
                height: 120
            });
        }
        
        this.banners = this.banners.filter(banner => {
            const screenX = banner.worldX - scrollOffset;
            return screenX + banner.width > -200;
        });
        
        this.mountains = this.mountains.filter(mountain => {
            const screenX = mountain.worldX - scrollOffset * mountain.parallaxSpeed;
            return screenX + mountain.width > -200;
        });
        
        const lastTurbineX = this.turbines.length > 0
            ? Math.max(...this.turbines.map(t => t.worldX))
            : scrollOffset;
        
        if (lastTurbineX - scrollOffset < canvas.width + 300) {
            const minHeight = 80;
            const maxHeight = (canvas.height - groundHeight) * 0.7;
            const towerHeight = minHeight + Math.random() * (maxHeight - minHeight);
            const newX = Math.max(lastTurbineX + 400, scrollOffset + canvas.width + 200);
            this.turbines.push(new WindTurbine(newX, towerHeight));
        }
        
        if (startTime === null) {
            startTime = Date.now();
        }
        const elapsedTime = (Date.now() - startTime) / 1000;
        gameTime = Math.max(0, MAX_TIME - elapsedTime);
        
        if (gameTime <= 0) {
            this.gameOver();
            return;
        }
        
        if (gameProgress >= FINISH_LINE_DISTANCE) {
            this.victory();
            return;
        }
        
        score = Math.floor(gameProgress / 10);
    }
    
    draw() {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0a0e27');
        gradient.addColorStop(0.5, '#1a1f3a');
        gradient.addColorStop(1, '#2d1b3d');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        this.stars.forEach(star => {
            star.brightness += star.twinkleSpeed;
            if (star.brightness > 1.0) {
                star.brightness = 0.5;
            }
            
            const starX = (star.x - scrollOffset * 0.1) % canvas.width;
            const finalStarX = starX < 0 ? starX + canvas.width : starX;
            
            const alpha = 0.5 + Math.sin(star.brightness * Math.PI * 2) * 0.5;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(finalStarX, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(finalStarX, star.y, star.size * 2, 0, Math.PI * 2);
            ctx.fill();
        });
        
        const farMountains = this.mountains.filter(m => m.layer === 'far');
        const nearMountains = this.mountains.filter(m => m.layer === 'near');
        
        farMountains.forEach(mountain => {
            const screenX = mountain.worldX - scrollOffset * mountain.parallaxSpeed;
            const groundY = canvas.height - groundHeight;
            const baseY = groundY;
            const peakY = baseY - mountain.height;
            
            if (screenX + mountain.width < 0 || screenX > canvas.width) {
                return;
            }
            
            ctx.fillStyle = '#151520';
            ctx.beginPath();
            ctx.moveTo(screenX, baseY);
            ctx.lineTo(screenX + mountain.width / 2, peakY);
            ctx.lineTo(screenX + mountain.width, baseY);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.beginPath();
            ctx.moveTo(screenX + mountain.width * 0.6, baseY);
            ctx.lineTo(screenX + mountain.width / 2, peakY);
            ctx.lineTo(screenX + mountain.width, baseY);
            ctx.closePath();
            ctx.fill();
        });
        
        nearMountains.forEach(mountain => {
            const screenX = mountain.worldX - scrollOffset * mountain.parallaxSpeed;
            const groundY = canvas.height - groundHeight;
            const baseY = groundY;
            const peakY = baseY - mountain.height;
            
            if (screenX + mountain.width < 0 || screenX > canvas.width) {
                return;
            }
            
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.moveTo(screenX, baseY);
            ctx.lineTo(screenX + mountain.width / 2, peakY);
            ctx.lineTo(screenX + mountain.width, baseY);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            ctx.beginPath();
            ctx.moveTo(screenX + mountain.width * 0.6, baseY);
            ctx.lineTo(screenX + mountain.width / 2, peakY);
            ctx.lineTo(screenX + mountain.width, baseY);
            ctx.closePath();
            ctx.fill();
        });
        
        this.banners.forEach(banner => {
            const screenX = banner.worldX - scrollOffset;
            const groundY = canvas.height - groundHeight;
            
            if (screenX + banner.width < 0 || screenX > canvas.width) {
                return;
            }
            
            ctx.save();
            
            const poleWidth = 8;
            const poleHeight = banner.y - groundY;
            
            ctx.fillStyle = '#B0B0B0';
            ctx.fillRect(screenX - poleWidth / 2, groundY, poleWidth, poleHeight);
            
            ctx.fillRect(screenX + banner.width - poleWidth / 2, groundY, poleWidth, poleHeight);
            
            ctx.fillStyle = '#D0D0D0';
            ctx.beginPath();
            ctx.roundRect(screenX, banner.y - banner.height / 2, banner.width, banner.height, 5);
            ctx.fill();
            
            ctx.strokeStyle = '#B8B8B8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(screenX, banner.y - banner.height / 2, banner.width, banner.height, 5);
            ctx.stroke();
            
            if (logoBigImage) {
                const padding = 5;
                const logoWidth = banner.width - padding * 2;
                const logoHeight = banner.height - padding * 2;
                const logoX = screenX + padding;
                const logoY = banner.y - banner.height / 2 + padding;
                
                ctx.drawImage(logoBigImage, logoX, logoY, logoWidth, logoHeight);
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.fillRect(logoX, logoY, logoWidth, logoHeight);
            }
            
            ctx.restore();
        });
        
        const groundY = canvas.height - groundHeight;
        
        const snowGradient = ctx.createLinearGradient(0, groundY, 0, canvas.height);
        snowGradient.addColorStop(0, '#FFFFFF');
        snowGradient.addColorStop(0.3, '#F5F5FF');
        snowGradient.addColorStop(0.6, '#E8E8FF');
        snowGradient.addColorStop(1, '#E0E0F0');
        ctx.fillStyle = snowGradient;
        ctx.fillRect(0, groundY, canvas.width, groundHeight);
        
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
        
        ctx.fillStyle = 'rgba(200, 220, 255, 0.6)';
        for (let i = 0; i < 25; i++) {
            const x = ((-scrollOffset * 0.15) + i * 50) % canvas.width;
            const y = groundY + 15 + (i % 6) * 10 + Math.cos(i * 0.4) * 5;
            const finalX = x < 0 ? x + canvas.width : x;
            const size = Math.random() * 1.5 + 0.5;
            ctx.fillRect(finalX - size, y - size, size * 2, size * 2);
        }
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        for (let i = 0; i < 15; i++) {
            const x = ((-scrollOffset * 0.25) + i * 80) % canvas.width;
            const y = groundY + 20 + (i % 5) * 12;
            const finalX = x < 0 ? x + canvas.width : x;
            const size = 2;
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
        
        ctx.fillStyle = 'rgba(200, 200, 220, 0.2)';
        for (let i = 0; i < 20; i++) {
            const x = ((-scrollOffset * 0.1) + i * 60) % canvas.width;
            const y = groundY + 5 + (i % 7) * 9;
            const finalX = x < 0 ? x + canvas.width : x;
            ctx.beginPath();
            ctx.arc(finalX, y, 3 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        this.turbines.forEach(turbine => turbine.draw());
        
        const finishLineScreenX = FINISH_LINE_DISTANCE - scrollOffset;
        if (finishLineScreenX >= -50 && finishLineScreenX <= canvas.width + 50) {
            const groundY = canvas.height - groundHeight;
            const beamWidth = 12;
            const beamHeight = groundY;
            const beamY = 0;
            const beamX = finishLineScreenX - beamWidth / 2;
            
            const beamGradient = ctx.createLinearGradient(beamX, beamY, beamX + beamWidth, beamY);
            beamGradient.addColorStop(0, '#FFFFFF');
            beamGradient.addColorStop(0.5, '#FFD700');
            beamGradient.addColorStop(1, '#FFFFFF');
            ctx.fillStyle = beamGradient;
            ctx.fillRect(beamX, beamY, beamWidth, beamHeight);
            
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
            ctx.fillRect(beamX - 5, beamY, beamWidth + 10, beamHeight);
            ctx.shadowBlur = 0;
            
            const stripeHeight = 30;
            for (let y = beamY; y < beamHeight; y += stripeHeight * 2) {
                ctx.fillStyle = '#DC143C';
                ctx.fillRect(beamX, y, beamWidth, stripeHeight);
            }
        }
        
        if (gameState === 'playing' || (gameState === 'start' && introAnimationProgress > 0) || gameState === 'victory') {
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
            
            if (gameState === 'start' && introAnimationProgress > 0) {
                const easeOut = 1 - Math.pow(1 - introAnimationProgress, 3);
                const startX = -this.player.width * 2;
                const endX = canvas.width * 0.15;
                const animatedX = startX + (endX - startX) * easeOut;
                
                const originalX = this.player.x;
                this.player.x = animatedX;
                this.player.draw(false, 0);
                this.player.x = originalX;
                
                const hudProgress = Math.min(1, (introAnimationProgress - 0.3) / 0.4);
                if (hudProgress > 0) {
                    ctx.save();
                    ctx.globalAlpha = hudProgress;
                    this.drawProgressBar(hudProgress);
                    this.drawTimerBar(hudProgress);
                    this.drawSpeedBar(hudProgress);
                    ctx.restore();
                }
            } else if (gameState === 'playing') {
                if (isCrashing) {
                    const originalRotation = this.player.rotation;
                    const originalBalloonSize = this.player.balloonSize;
                    
                    this.player.rotation = 0;
                    this.player.balloonSize = Math.max(0.3, 1 - crashAnimationProgress * 0.7);
                    
                    const fadeOpacity = 1 - crashAnimationProgress * 0.8;
                    
                    ctx.save();
                    ctx.globalAlpha = fadeOpacity;
                    this.player.draw(false, 0, true);
                    ctx.restore();
                    
                    crashParticles.forEach(particle => {
                        ctx.save();
                        ctx.globalAlpha = particle.life;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.beginPath();
                        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    });
                    
                    this.player.rotation = originalRotation;
                    this.player.balloonSize = originalBalloonSize;
                    
                    crashParticles.forEach(particle => {
                        ctx.save();
                        ctx.globalAlpha = particle.life;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.beginPath();
                        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    });
                } else {
                    this.player.draw(isInWindStream, horizontalSpeed);
                }
                this.drawProgressBar(1);
                this.drawTimerBar(1);
                this.drawSpeedBar(1);
            } else if (gameState === 'victory') {
                this.player.draw(false, 0, false);
            }
        }
        
        if (gameState === 'start' && introAnimationProgress === 0) {
            this.drawStartMenu();
        }
        
        if (gameState === 'victory') {
            fireworks.forEach(firework => {
                ctx.save();
                ctx.globalAlpha = firework.life * 0.9;
                ctx.fillStyle = firework.color;
                ctx.beginPath();
                ctx.arc(firework.x, firework.y, firework.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowColor = firework.color;
                ctx.shadowBlur = 10;
                ctx.globalAlpha = firework.life * 0.5;
                ctx.fill();
                ctx.restore();
            });
        }
        
        if (gameState === 'victory') {
            this.drawVictoryScreen();
        }
        
        if (gameState === 'gameOver') {
            this.drawGameOverScreen();
        }
    }
    
    drawProgressBar(slideProgress = 1) {
        const barX = canvas.width / 2;
        const barY = 40 - (1 - slideProgress) * 60;
        const barWidth = canvas.width * 0.85;
        const barHeight = 50;
        
        const progress = Math.min(1, gameProgress / FINISH_LINE_DISTANCE);
        
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
        
        ctx.strokeStyle = 'rgba(74, 144, 226, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(barX - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 15);
        ctx.stroke();
        
        const progressWidth = (barWidth - 60) * progress;
        const progressStartX = barX - barWidth / 2 + 30;
        
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
        
        const playerIconX = barX - barWidth / 2 + 15;
        const playerIconY = barY;
        const playerIconSize = 30;
        
        ctx.save();
        ctx.translate(playerIconX, playerIconY);
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.arc(0, -8, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-5, 0, 10, 6);
        ctx.restore();
        
        const finishIconX = barX + barWidth / 2 - 15;
        const finishIconY = barY;
        const finishIconSize = 30;
        
        ctx.save();
        ctx.translate(finishIconX, finishIconY);
        ctx.fillStyle = '#000';
        ctx.fillRect(-8, -12, 16, 12);
        ctx.fillStyle = '#FFF';
        ctx.fillRect(-8, -12, 8, 6);
        ctx.fillRect(0, -6, 8, 6);
        ctx.fillStyle = '#654321';
        ctx.fillRect(-1, -12, 2, 20);
        ctx.restore();
    }
    
    drawTimerBar(slideProgress = 1) {
        const barX = canvas.width / 2;
        const barY = 100 - (1 - slideProgress) * 60;
        const barWidth = 150;
        const barHeight = 35;
        
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
        
        const borderColor = gameTime < 10 ? 'rgba(255, 68, 68, 0.8)' : 'rgba(74, 144, 226, 0.5)';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(barX - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 12);
        ctx.stroke();
        
        const iconX = barX - barWidth / 2 + 20;
        const iconY = barY;
        const iconSize = 16;
        
        ctx.save();
        ctx.translate(iconX, iconY);
        const iconColor = gameTime < 10 ? '#FF4444' : '#4A90E2';
        ctx.strokeStyle = iconColor;
        ctx.fillStyle = iconColor;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(0, 0, iconSize / 2, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -iconSize / 3);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(iconSize / 4, 0);
        ctx.stroke();
        
        ctx.restore();
        
        const timeColor = gameTime < 10 ? '#FF4444' : '#2C5F8D';
        ctx.fillStyle = timeColor;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.ceil(gameTime)}s`, barX, barY);
    }
    
    drawSpeedBar(slideProgress = 1) {
        const barX = canvas.width / 2;
        const barY = 130 - (1 - slideProgress) * 60;
        const barWidth = 200;
        const barHeight = 20;
        const maxSpeed = 4.0;
        
        const minSpeed = 0.7;
        const speedPercent = Math.min(1, Math.max(0, (horizontalSpeed - minSpeed) / (maxSpeed - minSpeed)));
        
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
        
        const fillGradient = ctx.createLinearGradient(
            barX - barWidth / 2,
            barY - barHeight / 2,
            barX + barWidth / 2,
            barY + barHeight / 2
        );
        if (speedPercent < 0.5) {
            fillGradient.addColorStop(0, '#4CAF50');
            fillGradient.addColorStop(1, '#FFC107');
        } else {
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
        
        ctx.strokeStyle = 'rgba(74, 144, 226, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(barX - barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 10);
        ctx.stroke();
        
        ctx.fillStyle = '#2C5F8D';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Geschwindigkeit', barX, barY);
    }
    
    drawStartMenu() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const menuWidth = Math.min(400, canvas.width * 0.8);
        const menuHeight = 320;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(menuX - menuWidth / 2, menuY - menuHeight / 2, menuWidth, menuHeight, 20);
        ctx.fill();
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
        
        ctx.fillStyle = '#2C5F8D';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent';
        ctx.fillText('Wind Runner', menuX, menuY - 80);
        
        ctx.fillStyle = '#4A90E2';
        ctx.font = 'italic 18px Arial';
        ctx.fillText('Nutze die Windkraft zum Fliegen!', menuX, menuY - 30);
        
        const buttonY = menuY + 20;
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
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('START', menuX, buttonY + 8);
        
        ctx.fillStyle = '#888';
        ctx.font = 'italic 14px Arial';
        ctx.fillText('Halten, um den Ballon zu füllen', menuX, menuY + 70);
        
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText('Telefon: Kliknij na ekran', menuX, menuY + 95);
        ctx.fillText('PC: Kliknij w ekran', menuX, menuY + 115);
    }
    
    drawGameOverScreen() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const menuWidth = Math.min(350, canvas.width * 0.8);
        const menuHeight = 240;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(menuX - menuWidth / 2, menuY - menuHeight / 2, menuWidth, menuHeight, 20);
        ctx.fill();
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
        
        ctx.fillStyle = '#E2001A';
        ctx.font = 'bold 42px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent';
        ctx.fillText('Spiel beendet', menuX, menuY - 40);
        
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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const menuWidth = Math.min(350, canvas.width * 0.8);
        const menuHeight = 320;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.roundRect(menuX - menuWidth / 2, menuY - menuHeight / 2, menuWidth, menuHeight, 20);
        ctx.fill();
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
        
        ctx.fillStyle = '#4CAF50';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'transparent';
        ctx.fillText('Erfolg!', menuX, menuY - 70);
        
        ctx.fillStyle = '#555';
        ctx.font = '20px Arial';
        ctx.fillText('Mit Hilfe des Windes', menuX, menuY - 20);
        ctx.fillText('hast du das Ziel', menuX, menuY + 5);
        ctx.fillText('vor Ablauf der Zeit erreicht!', menuX, menuY + 30);
        
        const buttonY = menuY + 80;
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
        isJetpackActive = false;
    }
    
    victory() {
        gameState = 'victory';
        isJetpackActive = false;
        fireworks = [];
        fireworksTimer = 0;
    }
    
    reset() {
        this.player = new Player();
        this.turbines = [];
        this.frameCount = 0;
        score = 0;
        gameProgress = 0;
        horizontalSpeed = 0;
        scrollOffset = 0;
        isCrashing = false;
        crashAnimationProgress = 0;
        crashBounceVelocity = 0;
        crashParticles = [];
        isJetpackActive = false;
        windMomentum = 0;
        introAnimationProgress = 0;
        gameTime = MAX_TIME;
        startTime = null;
        fireworks = [];
        fireworksTimer = 0;
        
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * (canvas.height - groundHeight),
                size: Math.random() * 2 + 1,
                brightness: Math.random() * 0.5 + 0.5,
                twinkleSpeed: Math.random() * 0.005 + 0.003
            });
        }
        
        this.mountains = [];
        for (let i = 0; i < 12; i++) {
            this.mountains.push({
                worldX: i * 250,
                height: Math.random() * (canvas.height - groundHeight) * 0.3 + (canvas.height - groundHeight) * 0.15,
                width: Math.random() * 180 + 120,
                parallaxSpeed: 0.2,
                layer: 'far'
            });
        }
        for (let i = 0; i < 10; i++) {
            this.mountains.push({
                worldX: i * 300,
                height: Math.random() * (canvas.height - groundHeight) * 0.5 + (canvas.height - groundHeight) * 0.25,
                width: Math.random() * 220 + 160,
                parallaxSpeed: 0.4,
                layer: 'near'
            });
        }
        
        this.banners = [];
        for (let i = 0; i < 3; i++) {
            this.banners.push({
                worldX: (i + 1) * 1500,
                y: (canvas.height - groundHeight) * 0.625 + Math.random() * (canvas.height - groundHeight) * 0.1875,
                width: 300,
                height: 120
            });
        }
        
        const availableHeight = canvas.height - groundHeight;
        this.turbines.push(new WindTurbine(300, 100));
        this.turbines.push(new WindTurbine(600, availableHeight * 0.5));
        this.turbines.push(new WindTurbine(900, availableHeight * 0.7));
    }
}

const game = new Game();

function handleClick(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    if (gameState === 'start') {
        if (introAnimationProgress < 0.1) {
            const menuX = canvas.width / 2;
            const menuY = canvas.height / 2;
            const buttonY = menuY + 20;
            const buttonWidth = 200;
            const buttonHeight = 50;
            
            if (x >= menuX - buttonWidth / 2 && x <= menuX + buttonWidth / 2 &&
                y >= buttonY - buttonHeight / 2 && y <= buttonY + buttonHeight / 2) {
                introAnimationProgress = 0.001;
            }
        }
    } else if (gameState === 'gameOver') {
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const buttonY = menuY + 50;
        const buttonWidth = 200;
        const buttonHeight = 50;
        
        if (x >= menuX - buttonWidth / 2 && x <= menuX + buttonWidth / 2 &&
            y >= buttonY - buttonHeight / 2 && y <= buttonY + buttonHeight / 2) {
            game.reset();
            gameState = 'start';
            introAnimationProgress = 0.001;
            isJetpackActive = false;
            return true;
        }
    } else if (gameState === 'victory') {
        const menuX = canvas.width / 2;
        const menuY = canvas.height / 2;
        const buttonY = menuY + 50;
        const buttonWidth = 200;
        const buttonHeight = 50;
        
        if (x >= menuX - buttonWidth / 2 && x <= menuX + buttonWidth / 2 &&
            y >= buttonY - buttonHeight / 2 && y <= buttonY + buttonHeight / 2) {
            game.reset();
            gameState = 'start';
            introAnimationProgress = 0.001;
            isJetpackActive = false;
            return true;
        }
    }
    return false;
}

function activateJetpack(event) {
    if (gameState === 'playing') {
        if (event) event.preventDefault();
        isJetpackActive = true;
    }
}

function deactivateJetpack(event) {
    if (gameState === 'playing') {
        if (event) event.preventDefault();
        isJetpackActive = false;
    }
}

canvas.addEventListener('click', handleClick);

canvas.addEventListener('mousedown', (e) => {
    if (gameState === 'playing') {
        e.preventDefault();
        activateJetpack(e);
    } else if (gameState === 'start' || gameState === 'gameOver' || gameState === 'victory') {
        e.preventDefault();
        handleClick(e);
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (gameState === 'playing') {
        e.preventDefault();
        deactivateJetpack(e);
    }
});

canvas.addEventListener('mouseleave', (e) => {
    if (gameState === 'playing') {
        deactivateJetpack(e);
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === 'start' || gameState === 'gameOver' || gameState === 'victory') {
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

function gameLoop() {
    game.update();
    game.draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

