import { ColorMath } from './ColorMath.js';
import { Templates } from './Templates.js';
import { Utils } from './Utils.js';
import { UIManager } from './UIManager.js';

// ==========================================================
// CHAPTER 1: CONFIGURATION & STATE
// ==========================================================
const IS_PRO_BUILD = window.hexStack.getIsProSync();
const IS_DEV = window.hexStack.getIsDevSync();

let lastDeleted = null;
let undoTimeout = null;
let isUndoHovered = false;
let fullHistory = [];
let systemLogs = [];
let selectedItems = new Set(); 
let expandedHex = null;
let tweakOpen = false;
let globalSettings = { tooltipsEnabled: true, maxItems: IS_PRO_BUILD ? 100 : 50 }; 

// Mock Chrome Storage Engine for Electron
const chrome = {
    storage: {
        sync: {
            get: (keys, cb) => {
                const keysArray = Array.isArray(keys) ? keys : Object.keys(keys);
                window.hexStack.storageGet(keysArray).then(result => { if (cb) cb(result); });
            },
            set: (data, cb) => {
                window.hexStack.storageSet(data).then(() => { if (cb) cb(); });
            }
        }
    },
    runtime: {
        sendMessage: (msg) => {
            if(msg.type === "EXTRACT_NOTIFY") {
                window.hexStack.showNotification("HexStack", `Color Extracted: ${msg.color}`);
            }
        }
    }
};

// ==========================================================
// CHAPTER 2: DOM ELEMENTS & TEMPLATES
// ==========================================================
const getEl = (id) => document.getElementById(id);

// 1. GET THE MODAL CONTAINER FIRST
const helpModal = getEl('helpModal');

// 2. INJECT TEMPLATES SO THE ELEMENTS ACTUALLY EXIST
if (helpModal) helpModal.innerHTML = Templates.getAboutHtml(IS_PRO_BUILD, IS_DEV);

// 3. NOW WE CAN QUERY THEM
const list = getEl('historyList');
const logContainer = getEl('systemLog');
const settingsPanel = getEl('settingsPanel');
const searchInput = getEl('searchInput');
const maxInput = getEl('maxItems');
const alwaysOnTopToggle = getEl('alwaysOnTopToggle');
const notifyToggle = getEl('notifyToggle');
const compactToggle = getEl('compactToggle');
const formatSelect = getEl('defaultCodeType');
const pickBtn = getEl('heroPickBtn');
const injectBtn = getEl('injectBtn');
const dlBtn = getEl('dlBtn');
const clrBtn = getEl('clrBtn');
const sortBtn = getEl('sortBtn');
const minBtn = getEl('minBtn'); 
const closeAppBtn = getEl('closeAppBtn');
const settingsBtn = getEl('realSettingsBtn');
const toggleLogBtn = getEl('toggleLog');
const flushLogBtn = getEl('flushLog');
const undoBtn = getEl('undoBtn');
const undoToast = getEl('undoToast');
const confirmModal = getEl('confirmModal');
const purgeModal = getEl('purgeModal');
const spinUp = getEl('spinUp');
const spinDown = getEl('spinDown');
const uiScaleSelect = getEl('uiScaleSelect');
const startupToggle = getEl('startupToggle');

const h3 = document.querySelector('h3');
if (h3) h3.innerHTML = `<span style="position: relative; display: inline-block;"><span style="color:var(--accent)">Hex</span><span style="color:white">Stack</span><span class="edition-label ${IS_PRO_BUILD ? 'pro' : 'core'}" style="position: absolute; left: 100%; top: 0; margin-left: 4px;">${IS_PRO_BUILD ? 'PRO' : 'CORE'}</span></span>`;

// Edition-Specific Boot Setup
if (!IS_PRO_BUILD) {
    if (dlBtn) dlBtn.style.display = 'none';
    if (maxInput) { maxInput.max = "50"; maxInput.min = "1"; maxInput.disabled = false; maxInput.style.opacity = "1"; maxInput.style.cursor = "text"; }
    if (spinUp) { spinUp.style.visibility = 'visible'; spinUp.style.opacity = "1"; spinUp.style.cursor = "pointer"; }
    if (spinDown) { spinDown.style.visibility = 'visible'; spinDown.style.opacity = "1"; spinDown.style.cursor = "pointer"; }
    if (formatSelect) { formatSelect.value = 'HEX'; formatSelect.disabled = true; }
    if (toggleLogBtn) { toggleLogBtn.classList.add('disabled'); toggleLogBtn.style.opacity = '0.5'; toggleLogBtn.setAttribute('data-tip', "Available in Pro version"); }
    if (flushLogBtn) flushLogBtn.disabled = true;
} else {
    if (maxInput) { maxInput.max = "500"; maxInput.min = "1"; }
    if (spinUp) spinUp.style.visibility = 'visible';
    if (spinDown) spinDown.style.visibility = 'visible';
    const licSection = getEl('licenseSection');
    if (licSection) licSection.style.display = 'none';
}

// ==========================================================
// CHAPTER 3: WINDOW SIZING (PIXEL CALIBRATION)
// ==========================================================
const updateWindowHeight = Utils.debounce((args = null) => {
    const isModalOpen = helpModal && helpModal.style.display === 'flex';
    const isSettingsOpen = document.body.classList.contains('settings-active');
    const scale = globalSettings.uiScale || 1;

    let targetW = (args instanceof Event) ? window.outerWidth : (typeof args === 'number') ? args : Math.ceil((isModalOpen ? 750 : 535) * scale);

    if (isModalOpen) {
        if (window.hexStack && window.hexStack.resize) window.hexStack.resize(Math.ceil(550 * scale), 2, targetW); 
        return;
    }

    const header = document.querySelector('.header');
    const footer = document.querySelector('.footer');
    const content = document.querySelector('.content');
    const items = list ? list.querySelectorAll('.item') : [];
    
    const minHeight = isSettingsOpen ? 293 : 190; 
    let totalRequired = minHeight;

    if (items.length > 0 && content) {
        let chromeHeight = (header ? header.offsetHeight : 70) + (footer ? footer.offsetHeight : 40);
        if (isSettingsOpen && settingsPanel) chromeHeight += settingsPanel.offsetHeight;

        const savedScroll = content.scrollTop;
        content.style.flex = 'none';
        content.style.height = 'auto'; 

        const intrinsicContentHeight = content.scrollHeight;
        content.style.flex = '';
        content.style.height = '';
        content.scrollTop = savedScroll;

        totalRequired = Math.ceil(chromeHeight + intrinsicContentHeight + 2);
    }

    const maxHeight = Math.floor(window.screen.availHeight * 0.9);
    let finalHeight = Math.max(totalRequired, minHeight);
    finalHeight = Math.ceil(finalHeight * scale);
    finalHeight = Math.min(finalHeight, maxHeight);

    if (window.hexStack && window.hexStack.resize) window.hexStack.resize(finalHeight, isSettingsOpen ? 1 : 0, targetW);
    if (content) content.style.overflowY = finalHeight >= maxHeight ? 'auto' : 'hidden';
}, 50);

window.addEventListener('resize', updateWindowHeight);

// ==========================================================
// CHAPTER 4: CORE LOGIC & STATE MANAGEMENT
// ==========================================================
const save = () => chrome.storage.sync.set({ colors: fullHistory }, refresh);

const capture = (hex) => {
    const h = hex.toUpperCase();
    systemLogs.unshift({ hex: h, ts: Date.now() });
    if (systemLogs.length > 100) systemLogs.pop(); 
    
    const isUnique = !fullHistory.find(c => c.hex === h);
    if (isUnique) {
        fullHistory.unshift({ hex: h, originalHex: h, label: "", pinned: false, timestamp: Date.now() });
        chrome.storage.sync.set({ logs: systemLogs, colors: fullHistory }, refresh);
    } else {
        chrome.storage.sync.set({ logs: systemLogs }, refresh);
    }
};

const refresh = () => {
    chrome.storage.sync.get(['colors', 'logs', 'maxItems', 'codeType', 'alwaysOnTop', 'notificationsEnabled', 'compactMode', 'sortMode', 'tooltipsEnabled', 'launchOnStartup', 'uiScale'], (data) => {
        globalSettings = { ...globalSettings, ...data, tooltipsEnabled: data.tooltipsEnabled !== false, notificationsEnabled: data.notificationsEnabled !== false };

        // --- THE LIMIT SETTINGS FIX ---
        let currentMax = parseInt(data.maxItems);
        if (isNaN(currentMax)) currentMax = IS_PRO_BUILD ? 100 : 50;

        if (!IS_PRO_BUILD) {
            currentMax = Math.min(50, currentMax); // Enforce ceiling, but allow lower values
        }
        globalSettings.maxItems = currentMax;
        if (maxInput) maxInput.value = currentMax;

        // Apply UI Toggles
        if(alwaysOnTopToggle) alwaysOnTopToggle.checked = !!globalSettings.alwaysOnTop;
        if(notifyToggle) notifyToggle.checked = globalSettings.notificationsEnabled;
        if(compactToggle) compactToggle.checked = !!globalSettings.compactMode;
        if(formatSelect) formatSelect.value = globalSettings.codeType || 'HEX';
        if(startupToggle) startupToggle.checked = !!globalSettings.launchOnStartup;
        if(uiScaleSelect) uiScaleSelect.value = globalSettings.uiScale || "1";
        
        const guideTooltipToggle = getEl('guideTooltipToggle');
        if(guideTooltipToggle) guideTooltipToggle.checked = globalSettings.tooltipsEnabled;

        window.hexStack.setAlwaysOnTop(!!globalSettings.alwaysOnTop);
        const contentArea = document.querySelector('.content');
        if (contentArea) contentArea.classList.toggle('compact-mode', !!globalSettings.compactMode);

        fullHistory = (data.colors || []).filter(c => c && c.hex && c.hex.startsWith('#'));
        systemLogs = data.logs || [];
        renderLogs();
        
        const currentSort = globalSettings.sortMode || 'TIME';
        if (sortBtn) sortBtn.textContent = `SORT: ${currentSort}`;
        
        let displayHistory = [...fullHistory];
        displayHistory.sort((a, b) => {
            if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
            if (currentSort === 'HUE') return ColorMath.getHue(b.hex) - ColorMath.getHue(a.hex);
            return b.timestamp - a.timestamp;
        });

        renderList(displayHistory, (!IS_PRO_BUILD ? 'HEX' : (globalSettings.codeType || 'HEX')));
    });
};

const showUndo = (item) => {
    lastDeleted = item;
    if (undoToast) {
        undoToast.style.display = 'flex';
        setTimeout(() => undoToast.classList.add('show'), 10);
    }
    if(undoTimeout) clearTimeout(undoTimeout);
    if (!isUndoHovered) {
        undoTimeout = setTimeout(() => {
            if (undoToast) { undoToast.classList.remove('show'); setTimeout(() => undoToast.style.display = 'none', 300); }
            lastDeleted = null;
        }, 4000);
    }
};

const renderLogs = () => {
    if(logContainer) {
        logContainer.innerHTML = systemLogs.length ? '' : '<div class="log-entry">> TERMINAL READY</div>';
        systemLogs.forEach((item) => {
            const div = document.createElement('div'); div.className = 'log-entry';
            div.innerHTML = `<span style="color:var(--muted)">[${new Date(item.ts).toLocaleTimeString()}]</span> EXT: ${Utils.escapeHTML(item.hex)}`;
            div.onclick = () => { 
                if (!fullHistory.find(c => c.hex === item.hex)) {
                    if (fullHistory.length >= globalSettings.maxItems) {
                        for (let i = fullHistory.length - 1; i >= 0; i--) {
                            if (!fullHistory[i].pinned) { fullHistory.splice(i, 1); break; }
                        }
                    }
                    fullHistory.unshift({ hex: item.hex, originalHex: item.hex, label: "Restored", pinned: false, timestamp: Date.now() }); 
                    save(); 
                } 
            };
            logContainer.appendChild(div);
        });
    }
};

const updateSelectionState = () => {
    const selSize = selectedItems.size;
    const count = fullHistory.length;
    const currentSort = globalSettings.sortMode || 'TIME';
    
    if (sortBtn) {
        if (selSize > 0) sortBtn.innerHTML = `<span style="color:var(--accent)">${selSize} SELECTED</span>`;
        else sortBtn.innerHTML = currentSort === 'ITEMS' ? `<span style="color:var(--accent)">${count} ITEMS</span>` : `SORT: ${currentSort}`;
    }
    
    if (selSize > 0) {
        document.body.classList.add('selection-mode'); 
        if(dlBtn) { dlBtn.textContent = `Export (${selSize})`; dlBtn.classList.add('active-selection'); }
        if(clrBtn) { clrBtn.textContent = `Delete (${selSize})`; clrBtn.classList.add('active-selection'); }
    } else {
        document.body.classList.remove('selection-mode'); 
        if(dlBtn) { dlBtn.textContent = "Export All"; dlBtn.classList.remove('active-selection'); }
        if(clrBtn) { clrBtn.textContent = "Clear All"; clrBtn.classList.remove('active-selection'); }
    }
};

// ==========================================================
// CHAPTER 5: LIST RENDERING ENGINE
// ==========================================================
const renderList = (history, type) => {
    const clipHeader = document.querySelector('.clip-history-header'); 
    if (!list) return;
    list.innerHTML = '';
    
    updateSelectionState();
    if (clipHeader) clipHeader.style.display = 'flex'; 

    if (!history.length) { 
        list.innerHTML = `<div class="empty-wrap"><li class="empty-state">HISTORY CLEAR</li></div>`; 
        updateWindowHeight();
        return; 
    }

    history.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'item';
        li.dataset.index = index;
        
        if (selectedItems.has(item.hex)) li.classList.add('selected-item');
        if (item.hex === expandedHex) {
            li.classList.add('expanded');
            li.classList.add('no-transition');
            setTimeout(() => li.classList.remove('no-transition'), 50);
        }
            
        const rgb = ColorMath.hexToRgb(item.hex);
        const displayCode = (!IS_PRO_BUILD) ? item.hex : 
            (type === 'RGB' ? rgb.str : 
             type === 'RGBA' ? ColorMath.hexToRgba(item.hex) : 
             type === 'HSL' ? ColorMath.hexToHsl(item.hex).str : 
             type === 'HSV' ? `hsv(${Math.round(ColorMath.hexToHsv(item.hex).h)}, ${Math.round(ColorMath.hexToHsv(item.hex).s)}%, ${Math.round(ColorMath.hexToHsv(item.hex).v)}%)` :
             type === 'HSVA' ? ColorMath.hexToHsva(item.hex) :
             type === 'CMYK' ? ColorMath.hexToCmyk(item.hex).str : 
             type === 'ARGB' ? ColorMath.hexToArgb(item.hex) : 
             item.hex);
        
        const shadesHTML = [0.4, 0.2, -0.2, -0.4].map(p => { 
            const hex = ColorMath.getShade(item.hex, p); 
            return `<div class="shade-box" style="background:${hex}" data-hex="${hex}" data-tip="${Math.abs(p*100)}% ${p>0?'Lighter':'Darker'}"></div>`; 
        }).join('');

        li.innerHTML = `
            <div class="item-header">
                <div class="header-left">
                    <div class="chk-wrap"><input type="checkbox" class="custom-chk row-chk" ${selectedItems.has(item.hex) ? 'checked' : ''}></div>
                    <div class="left-actions">
                        ${IS_PRO_BUILD ? `<button class="action-btn expand-btn"><i class="fa-solid fa-chevron-down"></i></button>` : ''}
                        <button class="action-btn star-btn ${item.pinned ? 'active' : ''}" title="${item.pinned ? 'Unfavorite' : 'Favorite'}"><i class="fa-${item.pinned ? 'solid' : 'regular'} fa-star"></i></button>
                    </div>
                </div>
                <div class="click-hint">Click Code to Copy</div>
                <button class="action-btn del-btn ${item.pinned ? 'disabled' : ''}" title="${item.pinned ? 'Unfavorite to delete' : 'Delete'}" style="margin-left: auto;"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="item-body">
                <div class="color-preview" style="background:${item.hex}"></div>
                <div class="static-shades">${shadesHTML}</div>
                <div style="display:flex; flex-direction:column; flex-grow:1; margin-left:3px;">
                    <div class="main-code">${Utils.escapeHTML(displayCode)}</div>
                </div>
                <div class="label-wrap"><div class="label-box" contenteditable="true">${Utils.escapeHTML(item.label || '')}</div></div>
            </div>
            ${IS_PRO_BUILD ? getProDetailsHTML(item, rgb) : ''}
        `;

        li.querySelector('.row-chk').onclick = (e) => { e.stopPropagation(); if (e.target.checked) selectedItems.add(item.hex); else selectedItems.delete(item.hex); updateSelectionState(); };
        li.querySelector('.star-btn').onclick = (e) => { e.stopPropagation(); item.pinned = !item.pinned; save(); };
        li.querySelector('.del-btn').onclick = (e) => { e.stopPropagation(); if (item.pinned) return; fullHistory = fullHistory.filter(h => h.hex !== item.hex); selectedItems.delete(item.hex); save(); showUndo(item); };
        li.querySelector('.main-code').onclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(e.target.innerText); UIManager.showTip(e.target, "Copied!"); };
        
        const lbl = li.querySelector('.label-box');
        lbl.onblur = (e) => { 
            const txt = e.target.innerText.trim();
            if (txt === '') { e.target.innerText = ''; item.label = ''; } else { item.label = txt; }
            save(); 
        };
        lbl.onclick = (e) => e.stopPropagation();
        li.querySelectorAll('.shade-box').forEach(box => box.onclick = (e) => { e.stopPropagation(); capture(box.dataset.hex); });

        if(IS_PRO_BUILD) attachProListeners(li, item);
        list.appendChild(li);
    });
    updateWindowHeight();
};

const getProDetailsHTML = (item, rgb) => {
    const hsl = ColorMath.hexToHsl(item.hex);
    const hsv = ColorMath.hexToHsv(item.hex);
    const hsva = ColorMath.hexToHsva(item.hex);
    const cmyk = ColorMath.hexToCmyk(item.hex);
    const argb = ColorMath.hexToArgb(item.hex);
    const access = ColorMath.getAccessibility(item.hex);
    
    const triad = [
        ColorMath.hslToHex((hsl.arr[0] + 120) % 360, hsl.arr[1], hsl.arr[2]), 
        ColorMath.hslToHex((hsl.arr[0] + 240) % 360, hsl.arr[1], hsl.arr[2])
    ];

    const makeChips = (arr) => `<div class="channel-chips">${arr.map(n => `<span class="channel-chip" data-val="${Math.round(n)}">${Math.round(n)}</span>`).join('')}</div>`;

    return `
    <div class="extra-codes">
        <details class="tweak-details" ${ (item.hex === expandedHex && tweakOpen) ? 'open' : '' }>
            <summary><span>Adjust Color</span><button class="reset-btn">Reset</button></summary>
            <div class="picker-area">
                <div class="compare-wrap">
                    <div class="compare-box" style="background:${item.originalHex};">ORIGINAL</div>
                    <div class="compare-box new-swatch" style="background:${item.hex};">NEW</div>
                </div>
                <div class="sl-field"><div class="picker-cursor"></div></div>
                <div class="hue-rail" style="height:10px; background:linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red); position:relative; border-radius:3px; margin-top:8px;"><div class="hue-cursor"></div></div>
            </div>
        </details>
        
        <div class="setting-row" style="margin-bottom:8px;">
            <span style="font-size: 0.65rem; color: var(--accent); font-weight: bold;">SIMULATE VISION</span>
            <select class="sim-select" style="width:100px;">
                <option value="none">Normal</option>
                <option value="protanopia">Protanopia</option>
                <option value="deuteranopia">Deuteranopia</option>
                <option value="tritanopia">Tritanopia</option>
            </select>
        </div>

        <div class="copy-box" data-code="${item.hex}" data-tip="Click to Copy HEX"><span>HEX</span> <span>${item.hex}</span></div>
        <div class="copy-box" data-code="${argb}" data-tip="Click to Copy ARGB"><span>ARGB</span> <span>${argb}</span></div>
        <div class="copy-box" data-code="${rgb.str}" data-tip="Click to Copy RGB"><span>RGB</span> <div style="display:flex; align-items:center;"><span style="margin-right:6px; font-weight:500; color:var(--accent);">${rgb.str}</span>${makeChips(rgb.arr)}</div></div>
        <div class="copy-box" data-code="${ColorMath.hexToRgba(item.hex)}" data-tip="Click to Copy RGBA"><span>RGBA</span> <div style="display:flex; align-items:center;"><span style="margin-right:6px; font-weight:500; color:var(--accent);">${ColorMath.hexToRgba(item.hex)}</span>${makeChips([...rgb.arr, 1])}</div></div>
        <div class="copy-box" data-code="${hsl.str}" data-tip="Click to Copy HSL"><span>HSL</span> <div style="display:flex; align-items:center;"><span style="margin-right:6px; font-weight:500; color:var(--accent);">${hsl.str}</span>${makeChips(hsl.arr)}</div></div>
        <div class="copy-box" data-code="hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)" data-tip="Click to Copy HSV"><span>HSV</span> <div style="display:flex; align-items:center;"><span style="margin-right:6px; font-weight:500; color:var(--accent);">hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)</span>${makeChips([hsv.h, hsv.s, hsv.v])}</div></div>
        <div class="copy-box" data-code="${hsva}" data-tip="Click to Copy HSVA"><span>HSVA</span> <div style="display:flex; align-items:center;"><span style="margin-right:6px; font-weight:500; color:var(--accent);">${hsva}</span>${makeChips([hsv.h, hsv.s, hsv.v, 1])}</div></div>
        <div class="copy-box" data-code="${cmyk.str}" data-tip="Click to Copy CMYK"><span>CMYK</span> <div style="display:flex; align-items:center;"><span style="margin-right:6px; font-weight:500; color:var(--accent);">${cmyk.str}</span>${makeChips(cmyk.arr)}</div></div>

        <div class="contrast-panel" data-inverted="false">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span class="pro-text-standard" style="font-size:0.55rem; color:var(--accent); text-transform:uppercase;">Text Contrast</span>
                <button class="action-btn swap-contrast-btn" title="Swap Foreground/Background" style="width:16px; height:16px; margin:0;"><i class="fa-solid fa-right-left"></i></button>
            </div>
            <div class="contrast-row">
                <span style="display:flex; align-items:center;">White (${access.white.ratio}:1) <button class="info-trigger click-only" data-nano="WCAG AA requires a minimum 4.5:1 contrast ratio for standard text readability.">i</button></span>
                <span class="pro-text-standard" style="color:${access.white.pass === 'PASS' ? 'var(--mint)' : '#e74c3c'}">${access.white.pass}</span>
                <div class="preview-box preview-white" style="background:${item.hex}; color:#FFF; padding:2px 6px; border-radius:2px; font-size:0.6rem; font-weight:500; text-align:center;">Sample Text</div>
            </div>
            <div class="contrast-row">
                <span style="display:flex; align-items:center;">Black (${access.black.ratio}:1) <button class="info-trigger click-only" data-nano="WCAG AA requires a minimum 4.5:1 contrast ratio for standard text readability.">i</button></span>
                <span class="pro-text-standard" style="color:${access.black.pass === 'PASS' ? 'var(--mint)' : '#e74c3c'}">${access.black.pass}</span>
                <div class="preview-box preview-black" style="background:${item.hex}; color:#000; padding:2px 6px; border-radius:2px; font-size:0.6rem; font-weight:500; text-align:center;">Sample Text</div>
            </div>
        </div>
        
        <div class="harmony-panel" style="margin-top:8px;">
            <div class="pro-text-standard" style="font-size:0.55rem; color:var(--accent); margin-bottom:4px; text-transform:none; display:flex; align-items:center; gap:5px;">
                    Triadic Matches <button class="info-trigger click-only" data-nano="3 colors evenly spaced (120°) on the color wheel. High contrast but balanced.">i</button>
                    <span style="opacity:0.75; margin-left:auto; text-transform:none;">Click match to extract</span>
                </div>
                <div style="display:flex; width:100%; border-radius:3px; overflow:hidden;">
                    <div class="harmony-chip" style="background:${triad[0]}; height:16px; flex:1;" data-hex="${triad[0]}"></div>
                    <div class="harmony-chip" style="background:${triad[1]}; height:16px; flex:1;" data-hex="${triad[1]}"></div>
                </div>
            </div>
        </div>
    </div>`;
};

const attachProListeners = (li, item) => {
    const slField = li.querySelector('.sl-field');
    const hueRail = li.querySelector('.hue-rail');
    const previewDiv = li.querySelector('.color-preview');
    const newSwatch = li.querySelector('.new-swatch');
    const mainCode = li.querySelector('.main-code');
    const resetBtn = li.querySelector('.reset-btn');
    let currentHsv = ColorMath.hexToHsv(item.hex);

    const updateUIFromHsv = (updateText = true) => {
        slField.style.background = `hsl(${currentHsv.h}, 100%, 50%)`;
        li.querySelector('.picker-cursor').style.left = `${currentHsv.s}%`;
        li.querySelector('.picker-cursor').style.top = `${100 - currentHsv.v}%`;
        li.querySelector('.hue-cursor').style.left = `${(currentHsv.h / 360) * 100}%`;
        const newHex = ColorMath.hsvToHex(currentHsv.h, currentHsv.s, currentHsv.v);
        previewDiv.style.background = newHex;
        newSwatch.style.background = newHex;
        if (updateText) mainCode.innerText = newHex;

        // INVERT CONTRAST LOGIC
        const contrastPanel = li.querySelector('.contrast-panel');
        const isInverted = contrastPanel && contrastPanel.dataset.inverted === 'true';
        
        const previewWhite = li.querySelector('.preview-white');
        if (previewWhite) {
            previewWhite.style.background = isInverted ? '#FFF' : newHex;
            previewWhite.style.color = isInverted ? newHex : '#FFF';
        }
        
        const previewBlack = li.querySelector('.preview-black');
        if (previewBlack) {
            previewBlack.style.background = isInverted ? '#000' : newHex;
            previewBlack.style.color = isInverted ? newHex : '#000';
        }
    };

    const handleDrag = (e, type) => {
        const rect = (type === 'SL' ? slField : hueRail).getBoundingClientRect();
        let x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (type === 'SL') {
            let y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            currentHsv.s = x * 100; currentHsv.v = (1 - y) * 100;
        } else {
            currentHsv.h = x * 360;
        }
        updateUIFromHsv(true);
    };

    const endDrag = () => {
         const newHex = ColorMath.hsvToHex(currentHsv.h, currentHsv.s, currentHsv.v);
         if (item.hex !== newHex) { item.hex = newHex; expandedHex = newHex; save(); }
         document.removeEventListener('mousemove', onMove);
         document.removeEventListener('mouseup', endDrag);
    };
    const onMove = (e) => handleDrag(e, li.dataset.dragType);

    slField.onmousedown = (e) => { li.dataset.dragType = 'SL'; handleDrag(e, 'SL'); document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', endDrag); };
    hueRail.onmousedown = (e) => { li.dataset.dragType = 'HUE'; handleDrag(e, 'HUE'); document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', endDrag); };

    // INVERT CONTRAST BUTTON
    const swapBtn = li.querySelector('.swap-contrast-btn');
    if (swapBtn) {
        swapBtn.onclick = (e) => {
            e.stopPropagation();
            const contrastPanel = li.querySelector('.contrast-panel');
            contrastPanel.dataset.inverted = contrastPanel.dataset.inverted === 'true' ? 'false' : 'true';
            updateUIFromHsv(false); 
        };
    }

    resetBtn.onclick = (e) => { e.stopPropagation(); item.hex = item.originalHex; expandedHex = item.hex; currentHsv = ColorMath.hexToHsv(item.hex); updateUIFromHsv(); save(); };
    li.querySelector('.expand-btn').onclick = (e) => { e.stopPropagation(); expandedHex = (expandedHex === item.hex) ? null : item.hex; li.classList.toggle('expanded'); updateWindowHeight(); };
    li.querySelector('details').addEventListener('toggle', function() { 
        if (document.body.contains(this)) {
            if (item.hex === expandedHex) tweakOpen = this.open; 
            updateWindowHeight(); 
            if (this.open) this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
    
    li.querySelectorAll('.copy-box').forEach(b => b.onclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(b.dataset.code); UIManager.showTip(b, "FULL CODE COPIED"); });
    li.querySelectorAll('.channel-chip').forEach(c => c.onclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(c.dataset.val); UIManager.showTip(c, "VALUE COPIED"); });

    li.querySelectorAll('.info-trigger').forEach(btn => {
        btn.removeAttribute('title'); 
        btn.onclick = (e) => { e.stopPropagation(); UIManager.showTip(btn, btn.getAttribute('data-nano'), false); };
    });
    
    li.querySelectorAll('.shade-box, .harmony-chip').forEach(c => c.onclick = (e) => { e.stopPropagation(); capture(c.dataset.hex); });
    
    const sim = li.querySelector('.sim-select');
    if(sim) {
        sim.onclick = e => e.stopPropagation();
        sim.onchange = e => previewDiv.style.filter = (e.target.value === 'none') ? 'none' : `url(#${e.target.value})`;
    }
    updateUIFromHsv(false);
};

// ==========================================================
// CHAPTER 6: SETTINGS ACTIONS (FAST SAVES)
// ==========================================================

const saveSetting = (key, val, requiresRender = false) => {
    globalSettings[key] = val;
    chrome.storage.sync.set({ [key]: val }, () => {
        if (requiresRender) refresh();
    });
};

if (alwaysOnTopToggle) {
    alwaysOnTopToggle.onchange = () => { 
        saveSetting('alwaysOnTop', alwaysOnTopToggle.checked, false);
        window.hexStack.setAlwaysOnTop(alwaysOnTopToggle.checked); 
    };
}
if (notifyToggle) notifyToggle.onchange = () => saveSetting('notificationsEnabled', notifyToggle.checked, false);
if (compactToggle) {
    compactToggle.onchange = () => {
        saveSetting('compactMode', compactToggle.checked, false);
        const contentArea = document.querySelector('.content');
        if (contentArea) contentArea.classList.toggle('compact-mode', compactToggle.checked);
        updateWindowHeight();
    };
}
if (formatSelect) formatSelect.onchange = () => saveSetting('codeType', formatSelect.value, true);
if (startupToggle) {
    startupToggle.onchange = () => { 
        saveSetting('launchOnStartup', startupToggle.checked, false);
        window.hexStack.send('toggle-startup', startupToggle.checked); 
    };
}
if (uiScaleSelect) {
    uiScaleSelect.onchange = () => {
        const scale = parseFloat(uiScaleSelect.value);
        saveSetting('uiScale', scale, false);
        window.hexStack.setZoom(scale);
        setTimeout(() => updateWindowHeight(), 150); 
    };
}

const guideTooltipToggle = getEl('guideTooltipToggle');
if (guideTooltipToggle) guideTooltipToggle.onchange = () => saveSetting('tooltipsEnabled', guideTooltipToggle.checked, false);

if (maxInput) {
    maxInput.onchange = () => {
        let val = parseInt(maxInput.value) || 20;
        const limit = IS_PRO_BUILD ? 500 : 50; 
        if (val > limit) { val = limit; UIManager.showTip(maxInput, `MAX ${limit} IN CORE`); }
        if (val < 1) val = 1;
        maxInput.value = val;
        saveSetting('maxItems', val, false);
    };
}
if (spinUp && maxInput) spinUp.onclick = () => { maxInput.stepUp(); maxInput.dispatchEvent(new Event('change')); };
if (spinDown && maxInput) spinDown.onclick = () => { maxInput.stepDown(); maxInput.dispatchEvent(new Event('change')); };

// ==========================================================
// CHAPTER 7: GLOBAL ACTIONS & EVENT LISTENERS
// ==========================================================

if (pickBtn) {
    pickBtn.onclick = () => window.hexStack.activatePicker(); 
    pickBtn.ondragstart = (e) => e.preventDefault(); 
} 

if (sortBtn) {
    sortBtn.onclick = () => {
        let nextSort = 'TIME';
        if (globalSettings.sortMode === 'TIME') nextSort = 'HUE';
        else if (globalSettings.sortMode === 'HUE') nextSort = 'ITEMS';
        saveSetting('sortMode', nextSort, true);
    };
}

window.hexStack.onPickedColor((hex) => { 
    capture(hex); 
    if (globalSettings.notificationsEnabled) chrome.runtime.sendMessage({ type: "EXTRACT_NOTIFY", color: hex }); 
});

if (closeAppBtn) closeAppBtn.onclick = () => window.hexStack.close(); 
if (minBtn) minBtn.onclick = () => window.hexStack.minimize(); 

const clearSearchBtn = document.getElementById('clearSearch');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        if (clearSearchBtn) clearSearchBtn.style.display = searchInput.value.length > 0 ? 'block' : 'none';
    });
    if (clearSearchBtn) {
        clearSearchBtn.onclick = () => { searchInput.value = ''; clearSearchBtn.style.display = 'none'; searchInput.focus(); };
    }
}

if (injectBtn && searchInput) {
    injectBtn.onclick = () => {
        const input = searchInput.value;
        const finalHex = ColorMath.parseAnyInput(input);
        if (finalHex) { 
            capture(finalHex); 
            searchInput.value = ''; 
            if (clearSearchBtn) clearSearchBtn.style.display = 'none';
        } else { 
            searchInput.classList.add('shake-err'); 
            setTimeout(() => searchInput.classList.remove('shake-err'), 300); 
        }
    };
    searchInput.onkeyup = (e) => { if (e.key === 'Enter') injectBtn.click(); };
}

if (undoBtn) undoBtn.onclick = () => { if(lastDeleted) { fullHistory.unshift(lastDeleted); save(); if (undoToast) undoToast.classList.remove('show'); lastDeleted = null; } };

if (clrBtn) {
    clrBtn.onclick = (e) => {
        e.stopPropagation();
        if (selectedItems.size > 0) {
            fullHistory = fullHistory.filter(item => !selectedItems.has(item.hex) || item.pinned);
            selectedItems.clear(); save();
        } else {
            if (confirmModal) confirmModal.style.display = 'flex';
        }
    };
}

if (getEl('confirmYes')) getEl('confirmYes').onclick = () => {
    const limit = globalSettings.maxItems || (IS_PRO_BUILD ? 100 : 50);
    const pinned = fullHistory.filter(c => c.pinned);
    fullHistory = pinned.slice(0, limit); 
    if (confirmModal) confirmModal.style.display = 'none';
    save();
};
if (getEl('confirmNo')) getEl('confirmNo').onclick = () => { if (confirmModal) confirmModal.style.display = 'none'; };

if (flushLogBtn) flushLogBtn.onclick = () => { if (purgeModal) purgeModal.style.display = 'flex'; };
if (getEl('purgeYes')) getEl('purgeYes').onclick = () => { saveSetting('logs', [], false); systemLogs = []; renderLogs(); if (purgeModal) purgeModal.style.display = 'none'; };
if (getEl('purgeNo')) getEl('purgeNo').onclick = () => { if (purgeModal) purgeModal.style.display = 'none'; };

const exportMenu = document.getElementById('exportMenu');
if (dlBtn && IS_PRO_BUILD && exportMenu) {
    dlBtn.onclick = (e) => {
        e.stopPropagation();
        exportMenu.style.display = exportMenu.style.display === 'flex' ? 'none' : 'flex';
    };
    document.querySelectorAll('.export-item').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            exportMenu.style.display = 'none';
            const format = item.getAttribute('data-type');
            const itemsToExport = selectedItems.size > 0 ? fullHistory.filter(h => selectedItems.has(h.hex)) : fullHistory;
            window.hexStack.downloadHistory(itemsToExport, format);
        };
    });
    document.addEventListener('click', () => { if (exportMenu) exportMenu.style.display = 'none'; });
}

if (toggleLogBtn && IS_PRO_BUILD && logContainer) toggleLogBtn.onclick = () => { logContainer.style.display = logContainer.style.display === 'block' ? 'none' : 'block'; updateWindowHeight(); };
if (settingsBtn && helpModal) settingsBtn.onclick = () => { helpModal.style.display = 'flex'; UIManager.initSettingsTabs(helpModal); updateWindowHeight(); };

const consoleBtn = document.getElementById('consoleBtn');
if (consoleBtn && settingsPanel) {
    consoleBtn.onclick = () => {
        const isHidden = settingsPanel.style.display === 'none' || settingsPanel.style.display === '';
        settingsPanel.style.display = isHidden ? 'block' : 'none';
        consoleBtn.style.color = isHidden ? 'var(--accent)' : 'var(--muted)';
        if (isHidden) {
            document.body.classList.add('settings-active');
            setTimeout(() => { if (searchInput) searchInput.focus(); }, 50);
        } else {
            document.body.classList.remove('settings-active');
        }
        updateWindowHeight();
    };
}

const closeHelpBtn = document.getElementById('closeHelpBtn');
if (closeHelpBtn && helpModal) closeHelpBtn.onclick = () => { helpModal.style.display = 'none'; updateWindowHeight(); };

// --- UPDATED SETTINGS BUTTONS (HEXSTACK) ---
const btnCheckUpd = document.getElementById('btnCheckUpdates') || document.getElementById('btn-check-updates');
if (btnCheckUpd) {
    btnCheckUpd.onclick = (e) => {
        e.preventDefault();
        // Uses the IS_PRO_BUILD constant defined at the top of the script
        if (IS_PRO_BUILD) {
            window.hexStack.openExternal('https://app.lemonsqueezy.com/my-orders/');
        } else {
            window.hexStack.openExternal('https://github.com/Mint-Logic/HexStack/releases');
        }
    };
}
const btnUpgradePro = document.getElementById('btnUpgradePro');
if (btnUpgradePro) btnUpgradePro.onclick = (e) => { e.preventDefault(); window.hexStack.openExternal("https://mintlogic.lemonsqueezy.com/checkout/buy/4959c488-38ff-4796-bd34-1f555721989e"); };

const devCoreToggle = document.getElementById('devCoreToggle');
if (devCoreToggle) {
    devCoreToggle.checked = !window.hexStack.getIsProSync(); 
    devCoreToggle.onchange = () => window.hexStack.devModeToggle(devCoreToggle.checked);
}

window.hexStack.onLicenseResponse((res) => {
    if (res.success) {
        Utils.showSystemToast("PRO UNLOCKED! RESTARTING...", true);
        
        // Add the Neon Flash
        const contentArea = document.querySelector('.content'); // Or whatever your main wrapper is
        if (contentArea) {
            contentArea.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
            contentArea.style.border = '1px solid #8CFA96';
            contentArea.style.boxShadow = '0 0 50px rgba(140, 250, 150, 0.8), inset 0 0 30px rgba(140, 250, 150, 0.5)';
        }
    } else {
        Utils.showSystemToast(`INVALID KEY: ${res.reason || 'Unknown Error'}`, false);
    }
});

if (undoToast) {
    undoToast.onmouseenter = () => { isUndoHovered = true; if (undoTimeout) clearTimeout(undoTimeout); };
    undoToast.onmouseleave = () => {
        isUndoHovered = false;
        undoTimeout = setTimeout(() => {
            if (undoToast) { undoToast.classList.remove('show'); setTimeout(() => undoToast.style.display = 'none', 300); }
            if (lastDeleted) { window.hexStack.deleteItem(lastDeleted.timestamp); lastDeleted = null; }
        }, 2000);
    };
}

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        const keyJson = prompt("Paste the content of your HexStack .mint file here:");
        if (keyJson) {
            try { JSON.parse(keyJson); if (window.hexStack) window.hexStack.validateLicenseString(keyJson); } 
            catch (err) { Utils.showSystemToast("INVALID JSON FORMAT", false); }
        }
    }
    if (e.key === 'Escape') {
        if (exportMenu && exportMenu.style.display === 'flex') { exportMenu.style.display = 'none'; return; }
        if (helpModal && helpModal.style.display === 'flex') { if (closeHelpBtn) closeHelpBtn.click(); return; }
        if (window.hexStack && window.hexStack.close) window.hexStack.close();
    }
});

// ==========================================================
// CHAPTER 8: BOOT & KICKOFF
// ==========================================================

refresh();

UIManager.initTooltips(() => globalSettings);
UIManager.initDragAndDropUI(document.getElementById('dropzone-overlay'), async (file) => {
    if (file.name.endsWith('.mint')) {
        try {
            const fileContent = await file.text(); 
            Utils.showSystemToast("DECRYPTING KEY...", true);
            if (window.hexStack) window.hexStack.validateLicense(fileContent);
        } catch (err) { Utils.showSystemToast("FAILED TO READ FILE", false); }
    } else { Utils.showSystemToast("INVALID FILE TYPE", false); }
});