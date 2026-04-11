// --- DYNAMIC CSS INJECTION ---
const style = document.createElement('style');
style.innerHTML = `
    body { margin: 0; overflow: hidden; background: transparent; }
    #bgCanvas { position: absolute !important; top: 0 !important; left: 0 !important; z-index: 1 !important; cursor: crosshair !important; }
    
    #loupe { 
        position: absolute !important; 
        z-index: 99999 !important; 
        width: 150px !important; 
        height: 150px !important; 
        box-shadow: 0 0 0 2px rgba(255,255,255,0.8), 0 5px 15px rgba(0,0,0,0.6) !important; 
        border-radius: 50% !important; 
        overflow: hidden !important; 
        pointer-events: none !important; 
    }
    
    #loupeCanvas { 
        width: 150px !important; 
        height: 150px !important; 
        display: block !important;
    }
    
    #loupe::before, #loupe::after { display: none !important; opacity: 0 !important; background: none !important; box-shadow: none !important; }
    
    #hexLabel { 
        position: absolute !important; 
        z-index: 99999 !important; 
        pointer-events: none !important; 
        font-family: 'Segoe UI', sans-serif !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        background: rgba(20, 22, 26, 0.95) !important;
        padding: 6px 10px !important;
        border-radius: 4px !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-bottom-width: 3px !important;
        white-space: nowrap !important;
        display: flex !important;
        align-items: center !important;
    }
`;
document.head.appendChild(style);

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

    const physX = Math.floor(cursorX * scaleFactor);
    const physY = Math.floor(cursorY * scaleFactor);
    const cropSize = (LOUPE_SIZE / ZOOM_LEVEL) * scaleFactor;
    
    loupeCtx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    loupeCtx.imageSmoothingEnabled = false;
    
    try {
        loupeCtx.drawImage(shadowCanvas, physX - cropSize / 2, physY - cropSize / 2, cropSize, cropSize, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    } catch(e) {}

    const pX = Math.min(Math.max(0, physX), bgCanvas.width - 1);
    const pY = Math.min(Math.max(0, physY), bgCanvas.height - 1);

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
    const physX = Math.floor(cursorX * scaleFactor);
    const physY = Math.floor(cursorY * scaleFactor);
    const pX = Math.min(Math.max(0, physX), bgCanvas.width - 1);
    const pY = Math.min(Math.max(0, physY), bgCanvas.height - 1);
    
    const p = shadowCtx.getImageData(pX, pY, 1, 1).data;
    const hex = `#${p[0].toString(16).padStart(2,'0')}${p[1].toString(16).padStart(2,'0')}${p[2].toString(16).padStart(2,'0')}`.toUpperCase();
    
    window.hexStack.colorSelected(hex);
}

document.addEventListener('click', selectColor);