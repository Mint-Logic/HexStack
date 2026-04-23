// --- DYNAMIC CSS INJECTION ---


const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d'); 

const shadowCanvas = document.createElement('canvas');
const shadowCtx = shadowCanvas.getContext('2d', { willReadFrequently: true });

const loupe = document.getElementById('loupe');
const loupeCanvas = document.getElementById('loupeCanvas');
const loupeCtx = loupeCanvas.getContext('2d');
const label = document.getElementById('hexLabel');

const LOUPE_SIZE = 150;
loupeCanvas.width = LOUPE_SIZE;
loupeCanvas.height = LOUPE_SIZE;

let screenImg = null;
let scaleFactor = 1;
let cursorX = 0;
let cursorY = 0;
let ZOOM_LEVEL = 4; 
let isPro = false;

window.hexStack.onResetPicker((data) => {
    screenImg = null;
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    shadowCanvas.width = 0;
    shadowCanvas.height = 0;
    bgCanvas.width = 0;
    bgCanvas.height = 0;
    
    loupe.style.display = 'none';
    label.style.display = 'none';
    
    isPro = data.isPro || false;
    
    if (data.x !== undefined && data.y !== undefined) { 
        cursorX = data.x; 
        cursorY = data.y; 
    }
});

window.hexStack.onScreenCapture((data) => {
    const img = new Image();
    img.onload = () => {
        scaleFactor = data.scale;
        
        bgCanvas.width = img.width; 
        bgCanvas.height = img.height;
        bgCanvas.style.width = data.width + 'px';
        bgCanvas.style.height = data.height + 'px';
        
        bgCtx.fillStyle = 'rgba(0, 0, 0, 0.01)';
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

        shadowCanvas.width = img.width;
        shadowCanvas.height = img.height;
        shadowCtx.drawImage(img, 0, 0);

        screenImg = img;
        loupe.style.display = 'block';
        label.style.display = 'flex';
        updatePicker();
        
        setTimeout(() => {
            window.hexStack.pickerReady();
        }, 50);
    };
    img.src = data.dataUrl; 
});

function updatePicker() {
    if (!screenImg) return;
    
    let lx = cursorX - LOUPE_SIZE / 2;
    let ly = cursorY - LOUPE_SIZE / 2;
    
    // --- THE REAL FIX: Force the CPU to render movement on strict hardware ---
    // --- LET THE GPU RENDER THE LENS ---
    loupe.style.transform = `translate(${lx}px, ${ly}px)`;
    label.style.transform = `translate(${cursorX + 25}px, ${cursorY + 25}px)`;
    
    // Reset absolute positioning so the transform starts from zero
    loupe.style.left = '0px';
    loupe.style.top = '0px';
    label.style.left = '0px';
    label.style.top = '0px';

    const physX = Math.floor(cursorX * scaleFactor) + 0.5;
    const physY = Math.floor(cursorY * scaleFactor) + 0.5;
    const cropSize = (LOUPE_SIZE / ZOOM_LEVEL) * scaleFactor;
    
    loupeCtx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.imageSmoothingEnabled = false;
    
    try {
        // Draw centered on the .5 coordinate
        loupeCtx.drawImage(shadowCanvas, physX - cropSize / 2, physY - cropSize / 2, cropSize, cropSize, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    } catch(e) {}

    // Sample from the same centered physical coordinate
    const pX = Math.floor(physX);
    const pY = Math.floor(physY);

    const p = shadowCtx.getImageData(pX, pY, 1, 1).data;
    const hex = `#${p[0].toString(16).padStart(2,'0')}${p[1].toString(16).padStart(2,'0')}${p[2].toString(16).padStart(2,'0')}`.toUpperCase();

    label.innerHTML = `
        <div style="width: 14px; height: 14px; background: ${hex}; border-radius: 3px; display: inline-block; margin-right: 8px; border: 1px solid rgba(255,255,255,0.4);"></div>
        <span style="color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8); letter-spacing: 0.5px;">${hex} <span style="opacity: 0.8; font-size: 10px; margin-left: 4px;">(${ZOOM_LEVEL}x)</span></span>
    `;
    
    label.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), 0 0 15px ${hex}40`;
    label.style.borderBottomColor = hex;
    label.style.borderLeftColor = hex;
    label.style.borderRightColor = hex;
}

document.addEventListener('mousemove', (e) => {
    // [FIX] Use clientX/Y to ensure we are tracking the mouse 
    // relative to the window that spans all monitors.
    cursorX = e.clientX;
    cursorY = e.clientY;
    
    requestAnimationFrame(updatePicker);
});

window.addEventListener('wheel', (e) => {
    const maxZoom = isPro ? 40 : 10;
    
    if (e.deltaY < 0) ZOOM_LEVEL = Math.min(ZOOM_LEVEL + 2, maxZoom);
    else ZOOM_LEVEL = Math.max(ZOOM_LEVEL - 2, 2);
    requestAnimationFrame(updatePicker);
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.hexStack.cancelPicker();
    
    let moved = false;
    const step = 1 / scaleFactor;
    
    if (e.key === 'ArrowUp') { cursorY -= step; moved = true; }
    if (e.key === 'ArrowDown') { cursorY += step; moved = true; }
    if (e.key === 'ArrowLeft') { cursorX -= step; moved = true; }
    if (e.key === 'ArrowRight') { cursorX += step; moved = true; }
    
    if (moved) { e.preventDefault(); requestAnimationFrame(updatePicker); }
    if (e.key === 'Enter') selectColor();
});

window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.hexStack.cancelPicker();
});

function selectColor() {
    if (!screenImg) return;
    const physX = Math.floor(cursorX * scaleFactor) + 0.5;
    const physY = Math.floor(cursorY * scaleFactor) + 0.5;
    const pX = Math.min(Math.max(0, physX), bgCanvas.width - 1);
    const pY = Math.min(Math.max(0, physY), bgCanvas.height - 1);
    
    const p = shadowCtx.getImageData(Math.floor(physX), Math.floor(physY), 1, 1).data;
    const hex = `#${p[0].toString(16).padStart(2,'0')}${p[1].toString(16).padStart(2,'0')}${p[2].toString(16).padStart(2,'0')}`.toUpperCase();
    
    window.hexStack.colorSelected(hex);
}

document.addEventListener('click', selectColor);