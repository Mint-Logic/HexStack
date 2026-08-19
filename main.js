const { 
    app, 
    BrowserWindow, 
    ipcMain, 
    shell, 
    desktopCapturer, 
    screen, 
    Tray, 
    Menu, 
    globalShortcut, 
    nativeImage, 
    Notification,
    dialog 
} = require('electron');
require('electron').nativeTheme.themeSource = 'dark';
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

const path = require('path');
const fs = require('fs');
const Store = require('electron-store'); 
const { machineIdSync } = require('node-machine-id');

// [NEW] Import License Manager
const licenseMgr = require('./licenseManager');

// --- [UPGRADED] ASYNC STARTUP CHECK ---
let IS_PRO_BUILD = false; 
let REAL_PRO_STATUS = false; // Added to match the Dev Toggle logic

async function initializeLicense() {
    try {
        const licenseStatus = await licenseMgr.loadLicense('HexStack');
        if (licenseStatus && licenseStatus.valid) {
            IS_PRO_BUILD = true;
            REAL_PRO_STATUS = true;
            console.log(`[LICENSE] HexStack Hardware Verified`);
        }
    } catch (e) {
        console.error("[LICENSE] Startup Error:", e);
    }
}

if (process.platform === 'win32') {
    app.setAppUserModelId(app.isPackaged ? 'com.hexstack.app' : process.execPath);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    // --- STANDARDIZED STORAGE PATHS ---
    const MINT_LOGIC_PATH = path.join(app.getPath('appData'), 'MintLogic');
    const APP_STORAGE_PATH = path.join(MINT_LOGIC_PATH, 'HexStack');

    const ensureStorage = () => {
        try {
            if (!fs.existsSync(MINT_LOGIC_PATH)) fs.mkdirSync(MINT_LOGIC_PATH);
            if (!fs.existsSync(APP_STORAGE_PATH)) fs.mkdirSync(APP_STORAGE_PATH);
            return true;
        } catch (e) {
            console.error("Storage Init Failed:", e);
            return false;
        }
    };

    ensureStorage();

    const storeDefaults = {
        windowBounds: { width: 535, height: 293 }, 
        colors: [],
        logs: [],
        maxItems: 100,
        codeType: 'HEX',
        alwaysOnTop: true,
        notificationsEnabled: false,
        compactMode: false,
        sortMode: 'TIME',
        isPaused: false
    };

    const store = new Store({ 
        cwd: APP_STORAGE_PATH, 
        defaults: storeDefaults 
    });
    
    // [PRIVACY] RAM Store for Core Mode
    let memoryStore = JSON.parse(JSON.stringify(storeDefaults));

    const db = {
        get: (key) => {
            if (IS_PRO_BUILD) return store.get(key);
            return key ? memoryStore[key] : memoryStore;
        },
        set: (key, val) => {
            if (IS_PRO_BUILD) { store.set(key, val); } else { memoryStore[key] = val; }
        },
        getBulk: (keys) => {
            const result = {};
            const source = IS_PRO_BUILD ? store.store : memoryStore;
            keys.forEach(k => result[k] = source[k]);
            return result;
        },
        setBulk: (data) => {
            if (IS_PRO_BUILD) { store.set(data); } else { Object.assign(memoryStore, data); }
        }
    };

    let mainWindow;
    let pickerWindow;
    let tray = null;
    let isAlwaysOnTop = false; 
    let isQuitting = false;

    const icoPath = path.join(__dirname, 'icon.ico');
    const pngPath = path.join(__dirname, 'icon.png');
    const pausedIcoPath = path.join(__dirname, 'icon_paused.ico'); 
    const pausedPngPath = path.join(__dirname, 'icon_paused.png');

    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });

    function getAppIcon() {
        const isPaused = db.get('isPaused');
        const standardIcon = fs.existsSync(icoPath) ? icoPath : pngPath;
        const pausedIcon = fs.existsSync(pausedIcoPath) ? pausedIcoPath : pausedPngPath;
        return (isPaused && fs.existsSync(pausedIcon)) ? pausedIcon : standardIcon;
    }

    // [SECURITY HELPER] Validate URLs
    const isSafeUrl = (url) => {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (e) { return false; }
    };

    function createWindow() {
        const { x, y, width, height } = db.get('windowBounds') || {};

        const isStartupLaunch = process.argv.includes('--hidden');

        mainWindow = new BrowserWindow({
            show: false,
            center: true,
            width: 535,
            height: Math.max(190, height || 190),
            minWidth: 535,
            minHeight: 190, 
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            resizable: false, 
            thickFrame: false, 
            maximizable: false,
            fullscreenable: false,
            skipTaskbar: true, 
            icon: getAppIcon(), 
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });

        mainWindow.loadFile('index.html');

        // Safely intercept Ctrl+Shift+I OR F12 only when HexStack is actively focused
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
                event.preventDefault();
                mainWindow.webContents.openDevTools({mode: 'detach'});
            }
        });

        mainWindow.webContents.on('devtools-closed', () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.setOpacity(0.99);
                setTimeout(() => {
                    mainWindow.setOpacity(1.0);
                }, 50);
            }
        });

        mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            if (isSafeUrl(url)) {
                shell.openExternal(url);
            }
            return { action: 'deny' };
        });

        // SECURE: Block drag-and-drop or programmatic navigation to external websites
        mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
            event.preventDefault();
            console.warn('Navigation blocked to:', navigationUrl);
        });

       mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('init-status', IS_PRO_BUILD);
    
    // Check if Windows launched the app with the --hidden flag
    const isStartupLaunch = process.argv.some(arg => arg.includes('--hidden'));
    
    if (isStartupLaunch) {
        console.log("[STARTUP] HexStack started silently to tray.");
        mainWindow.hide();               // 1. Force window to stay hidden (no overlay!)
        mainWindow.setSkipTaskbar(true); // 2. Hide from Windows taskbar
    } else {
        mainWindow.setSkipTaskbar(false);
        mainWindow.show();
        mainWindow.focus();
    }
});

        let resizeTimeout;
        const saveBounds = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    db.set('windowBounds', mainWindow.getBounds());
                }
            }, 500);
        };

        mainWindow.on('move', saveBounds);
        mainWindow.on('resize', saveBounds);

        mainWindow.on('close', (event) => {
            if (isQuitting) return; 
            event.preventDefault();
            mainWindow.hide(); 
            return false;
        });
    }

    function createTray() {
        let trayImage = nativeImage.createFromPath(getAppIcon());

        if (!trayImage.isEmpty()) {
            tray = new Tray(trayImage);
            tray.setToolTip(IS_PRO_BUILD ? 'HexStack Pro' : 'HexStack Core');
            
            const contextMenu = Menu.buildFromTemplate([
                { label: IS_PRO_BUILD ? 'HexStack Pro' : 'HexStack Core', enabled: false },
                { type: 'separator' },
                { label: 'Show Window', click: () => { 
                    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
                }},
                { type: 'separator' },
                { label: 'Quit', click: () => { isQuitting = true; app.quit(); }}
            ]);
            
            tray.setContextMenu(contextMenu);
            tray.on('click', () => {
                if (mainWindow.isVisible()) mainWindow.hide();
                else { mainWindow.show(); mainWindow.focus(); }
            });
        }
    }

    function createPickerWindow() {
    if (pickerWindow && !pickerWindow.isDestroyed()) return;

    const displays = screen.getAllDisplays();
    const totalBounds = displays.reduce((acc, display) => {
        return {
            x: Math.min(acc.x, display.bounds.x),
            y: Math.min(acc.y, display.bounds.y),
            width: Math.max(acc.width, display.bounds.x + display.bounds.width),
            height: Math.max(acc.height, display.bounds.y + display.bounds.height)
        };
    }, { x: 0, y: 0, width: 0, height: 0 });

    pickerWindow = new BrowserWindow({
        x: totalBounds.x,
        y: totalBounds.y,
        width: totalBounds.width,
        height: totalBounds.height,
        show: false, 
        frame: false, 
        transparent: true,
        backgroundColor: '#00000000',
        alwaysOnTop: true, 
        enableLargerThanScreen: true,
        skipTaskbar: true, 
        resizable: false, 
        thickFrame: false, 
        movable: false,
        hasShadow: false, 
        focusable: false, // <--- Set to false until activated
        webPreferences: { 
            nodeIntegration: false, 
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    pickerWindow.loadFile('picker.html');
    pickerWindow.setOpacity(0);
    pickerWindow.setIgnoreMouseEvents(true, { forward: true }); // <--- Ensure mouse events pass through

    pickerWindow.webContents.on('will-navigate', (event) => {
        event.preventDefault();
    });
}

    let pickerActive = false;

    function activatePicker() {
        if (!pickerWindow || pickerWindow.isDestroyed()) createPickerWindow();

        pickerWindow.setOpacity(0);
        pickerWindow.setIgnoreMouseEvents(false); // Re-enable clicks for picking
        pickerWindow.show();
        pickerWindow.setAlwaysOnTop(true, 'screen-saver');

        setTimeout(async () => {
            const cursorPoint = screen.getCursorScreenPoint();
            const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);

            pickerWindow.setBounds({
                x: currentDisplay.bounds.x,
                y: currentDisplay.bounds.y,
                width: currentDisplay.bounds.width,
                height: currentDisplay.bounds.height
            });

            const localX = cursorPoint.x - currentDisplay.bounds.x;
            const localY = cursorPoint.y - currentDisplay.bounds.y;
            
            pickerWindow.webContents.send('reset-picker', { 
                x: localX, 
                y: localY, 
                isPro: IS_PRO_BUILD 
            });

            const thumbSize = {
                width: Math.ceil(currentDisplay.size.width * currentDisplay.scaleFactor),
                height: Math.ceil(currentDisplay.size.height * currentDisplay.scaleFactor)
            };

            try {
                const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: thumbSize });
                const source = sources.find(s => s.display_id === currentDisplay.id.toString()) || sources[0];
                
                if (source) {
                    pickerWindow.webContents.send('screen-capture', {
                        dataUrl: source.thumbnail.toDataURL(),
                        width: currentDisplay.bounds.width,
                        height: currentDisplay.bounds.height,
                        scale: currentDisplay.scaleFactor
                    });
                } else {
                    console.error("[Picker] No video sources found.");
                    pickerWindow.hide();
                }
            } catch (e) {
                console.error("[Picker] Capture failed:", e);
                pickerWindow.hide();
            }
        }, 150); 
    }

    function toggleWindow() {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.setSkipTaskbar(true);
                mainWindow.hide();
            } else {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.setSkipTaskbar(false);
                mainWindow.show();
                
                const topState = db.get('alwaysOnTop');
                mainWindow.setAlwaysOnTop(topState, 'pop-up-menu');
                if (topState) mainWindow.moveTop();
                
                mainWindow.focus();
            }
        }
    }

    app.whenReady().then(async () => {
    await initializeLicense(); 

    createTray();   // Always create the system tray icon first on boot!
    createWindow(); // Create the main window in hidden state

    globalShortcut.register('CommandOrControl+Shift+Space', () => {
        toggleWindow();
    });

    globalShortcut.register('CommandOrControl+Alt+P', () => {
        activatePicker();
    });
});

    app.on('will-quit', () => { globalShortcut.unregisterAll(); });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
    
    ipcMain.on('open-external', (event, url) => {
        if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
            shell.openExternal(url);
        }
    });
    
    ipcMain.on('dev-mode-toggle', (event, shouldBeCore) => {
        IS_PRO_BUILD = shouldBeCore ? false : REAL_PRO_STATUS;
        if (mainWindow) mainWindow.reload();
    });

    ipcMain.on('get-is-pro-sync', (event) => { 
        event.returnValue = IS_PRO_BUILD; 
    });

    ipcMain.on('get-is-dev-sync', (event) => { 
        event.returnValue = !app.isPackaged; 
    });

    ipcMain.on('validate-license', async (event, payload) => {
        console.log(`[DEBUG-MAIN] HexStack Passkey drop received!`);
        try {
            let rawData;
            if (typeof payload === 'string') {
                if (payload.trim().startsWith('{')) {
                    rawData = JSON.parse(payload);
                } else {
                    const fileContent = fs.readFileSync(payload, 'utf-8');
                    rawData = JSON.parse(fileContent);
                }
            } else {
                rawData = payload;
            }

            if (rawData.app !== 'HexStack') {
                return event.reply('license-response', { 
                    success: false, 
                    reason: `This key is for ${rawData.app || 'another app'}, not HexStack.` 
                });
            }

            let hwId;
            try {
                const { machineIdSync } = require('node-machine-id');
                hwId = machineIdSync();
            } catch (e) {
                const crypto = require('crypto');
                const os = require('os');
                hwId = crypto.createHash('sha256').update(os.hostname() + os.userInfo().username).digest('hex');
            }
            
            const UPSTASH_CHECK_URL = "https://mint-logic-site.vercel.app/api/check-activation";
            const cloudResponse = await fetch(UPSTASH_CHECK_URL, {
                method: 'POST',
                body: JSON.stringify({ order_id: rawData.order_id, hw_id: hwId, app: 'HexStack' }),
                headers: { 'Content-Type': 'application/json' }
            });

            const cloudResult = await cloudResponse.json();

            if (!cloudResult.authorized) {
                if (!app.isPackaged) {
                    console.log("🛠️ DEV MODE: Bypassing Upstash limit for local testing.");
                } else {
                    return event.reply('license-response', { 
                        success: false, 
                        reason: cloudResult.reason || "Activation limit reached (3 max)." 
                    });
                }
            }

            const payloadToSave = { 
                app: 'HexStack', 
                owner: rawData.owner, 
                order_id: rawData.order_id, 
                hw_id: hwId,
                unlocked: true 
            };
            
            const saved = licenseMgr.saveLicense(payloadToSave, 'HexStack');
            
            if (saved) {
                IS_PRO_BUILD = true;
                REAL_PRO_STATUS = true; 
                event.reply('license-response', { success: true, owner: rawData.owner });
                setTimeout(() => { if (mainWindow) mainWindow.reload(); }, 1500);
            } else {
                event.reply('license-response', { success: false, reason: "Local Windows OS Encryption failed." });
            }

        } catch (err) {
            console.error("[DEBUG-MAIN] Activation Error:", err);
            event.reply('license-response', { success: false, reason: "Invalid file format or connection error." });
        }
    });

    ipcMain.on('validate-license-string', async (event, rawJson) => {
        try {
            const tempPath = path.join(app.getPath('temp'), 'manual_license.mint');
            fs.writeFileSync(tempPath, rawJson);
            ipcMain.emit('validate-license', event, tempPath);
        } catch (e) {
            event.reply('license-response', { success: false, reason: "Manual entry failed." });
        }
    });

    ipcMain.on('nuke-license', () => {
        try {
            const licensePath = licenseMgr.getLicensePath('HexStack');
            if (fs.existsSync(licensePath)) {
                fs.unlinkSync(licensePath);
            }
            console.log("License Nuked. Restarting as Core.");
            app.relaunch();
            app.exit(0);
        } catch (e) {
            console.error("Failed to nuke license:", e);
        }
    });

    ipcMain.on('download-history', async (event, payloadStr, format) => {
        if (!IS_PRO_BUILD) return; 
        
        let ext = format || 'txt';
        let filterName = 'Text Files';

        if (format === 'css') filterName = 'CSS Stylesheet';
        else if (format === 'json') filterName = 'JSON File';

        try {
            const { filePath } = await dialog.showSaveDialog(mainWindow, { 
                defaultPath: `HexStack_Palette.${ext}`,
                filters: [{ name: filterName, extensions: [ext] }]
            });
            
            if (filePath) {
                fs.writeFileSync(filePath, payloadStr, 'utf-8');
                if (mainWindow) mainWindow.webContents.send('show-notification', { title: 'Export Complete', body: `Saved as .${ext}` });
            }
        } catch (error) {
            console.error("Export failed:", error);
        }
    });
	
    ipcMain.handle('storage-get', (event, keys) => db.getBulk(keys));

    ipcMain.handle('storage-set', (event, data) => {
        if (!IS_PRO_BUILD) {
            if (data.maxItems && data.maxItems > 50) {
                data.maxItems = 50; 
            }
            if (data.colors && data.colors.length > 50) {
                data.colors = data.colors.slice(0, 50);
            }
        }
        db.setBulk(data);
        return true;
    });

    ipcMain.on('close-app', () => { if(mainWindow) mainWindow.hide(); });
    ipcMain.on('minimize-window', () => { if (mainWindow) mainWindow.minimize(); });

    ipcMain.on('resize-window', (event, newHeight, layoutState, requestedWidth) => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
            const currentBounds = mainWindow.getBounds();
            
            let baseW = (layoutState === 2) ? 750 : 535;
            let targetW = typeof requestedWidth === 'number' ? requestedWidth : baseW;
            let scaleFactor = targetW / baseW;

            let minH = Math.floor(160 * scaleFactor);

            if (layoutState === 2) {
                minH = Math.floor(480 * scaleFactor);
            } else if (layoutState === 1) {
                minH = Math.floor(293 * scaleFactor);
            }

            const finalH = Math.max(minH, Math.floor(newHeight));

            const currentScreen = screen.getDisplayMatching(currentBounds);
            const { height: screenHeight, width: screenWidth, x: screenX, y: screenY } = currentScreen.workArea; 
            
            let newY = currentBounds.y;
            let newX = currentBounds.x;

            const PADDING = 10;

            const projectedBottomEdge = newY + finalH;
            const safeBottomEdge = screenY + screenHeight - PADDING;
            const safeTopEdge = screenY + PADDING;

            if (projectedBottomEdge > safeBottomEdge) {
                newY = safeBottomEdge - finalH;
            }
            if (newY < safeTopEdge) {
                newY = safeTopEdge;
            }

            const projectedRightEdge = newX + targetW;
            const safeRightEdge = screenX + screenWidth - PADDING;
            const safeLeftEdge = screenX + PADDING;

            if (projectedRightEdge > safeRightEdge) {
                newX = safeRightEdge - targetW;
            }
            if (newX < safeLeftEdge) {
                newX = safeLeftEdge;
            }

            if (currentBounds.width === targetW && currentBounds.height === finalH && currentBounds.y === newY && currentBounds.x === newX) {
                return; 
            }

            mainWindow.setMinimumSize(1, 1);
            mainWindow.setMaximumSize(9999, 9999);
            
            mainWindow.setBounds({ 
    x: newX, 
    y: newY, 
    width: targetW, 
    height: finalH 
}, false);

            mainWindow.setMinimumSize(targetW, minH);
            mainWindow.setMaximumSize(targetW, 9999);
        }
    });

    ipcMain.on('set-ui-zoom', (event, factor) => {
        if (mainWindow) mainWindow.webContents.setZoomFactor(factor);
    });

    ipcMain.on('set-always-on-top', (event, state) => {
        isAlwaysOnTop = state;
        db.set('alwaysOnTop', state);
        if (mainWindow && !mainWindow.isDestroyed()) { 
            mainWindow.setAlwaysOnTop(state, 'pop-up-menu');
            if (state) mainWindow.moveTop();
        }
    });

    ipcMain.on('show-notification', (event, { title, body }) => {
        if (db.get('notificationsEnabled') && Notification.isSupported()) {
            try {
                const toast = new Notification({ title: title || 'HexStack', body: body, icon: getAppIcon(), silent: false });
                toast.on('click', () => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        if (mainWindow.isMinimized()) mainWindow.restore();
                        mainWindow.show();
                        mainWindow.focus();
                    }
                });
                toast.show();
            } catch (err) { console.error(err); }
        }
    });

    ipcMain.on('activate-picker', activatePicker);
    
    ipcMain.on('picker-ready', () => {
        if(pickerWindow && !pickerWindow.isDestroyed()) {
            pickerWindow.setOpacity(1); 
            pickerWindow.setIgnoreMouseEvents(false);
            pickerWindow.focus(); 
        }
    });

    ipcMain.on('color-selected', (event, hex) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('picked-color', hex);
        }
    });

    ipcMain.on('cancel-picker', () => {
        if (pickerWindow && !pickerWindow.isDestroyed()) {
            pickerWindow.setAlwaysOnTop(false);
            pickerWindow.setOpacity(0);
            pickerWindow.setIgnoreMouseEvents(true);
        }
        if (mainWindow && !mainWindow.isDestroyed()) { 
            mainWindow.show(); 
            if (isAlwaysOnTop) mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
            mainWindow.focus(); 
        }
    });

// In main.js (~line 525)
ipcMain.on('toggle-startup', (event, isEnabled) => {
    db.set('launchOnStartup', isEnabled);

    if (app.isPackaged) {
        // Built EXE Production Path
        app.setLoginItemSettings({
            openAtLogin: isEnabled,
            path: app.getPath('exe'),
            args: ['--hidden']
        });
    } else {
        // Dev Mode / Unpackaged Path
        app.setLoginItemSettings({
            openAtLogin: isEnabled,
            path: process.execPath,
            args: [path.resolve(__dirname, 'main.js'), '--hidden']
        });
    }
    console.log(`[STARTUP] Launch on startup set to: ${isEnabled}`);
});
}