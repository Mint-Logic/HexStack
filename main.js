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
        const licenseStatus = await licenseMgr.loadLicense('HexStack'); // <-- CHANGED
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
        alwaysOnTop: true,           // THE FIX: Changed to true
        notificationsEnabled: false, // THE FIX: Changed to false
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
            skipTaskbar: false, 
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
    
    // THE FIX: Check for the silent startup flag
    const isStartupLaunch = process.argv.includes('--hidden');
    
    if (!isStartupLaunch) {
        mainWindow.show();
        mainWindow.focus();
    } else {
        console.log("[STARTUP] HexStack started silently to tray.");
        // Ensure tray exists if starting hidden
        if (!tray) createTray(); 
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

    // [FIX] Calculate the total bounds of all monitors combined
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
        // [FIX] Apply the total virtual desktop bounds
        x: totalBounds.x,
        y: totalBounds.y,
        width: totalBounds.width,
        height: totalBounds.height,
        show: false, 
        frame: false, 
        transparent: true,
        backgroundColor: '#00000000',
        alwaysOnTop: true, 
        enableLargerThanScreen: true, // Crucial for spanning
        skipTaskbar: true, 
        resizable: false, 
        thickFrame: false, 
        movable: false,
        hasShadow: false, 
        focusable: true,
        webPreferences: { 
            nodeIntegration: false, 
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    pickerWindow.loadFile('picker.html');
    pickerWindow.setOpacity(0);
    pickerWindow.setIgnoreMouseEvents(true);
    // SECURE: Ensure the invisible picker window cannot be navigated away
        pickerWindow.webContents.on('will-navigate', (event) => {
            event.preventDefault();
        });
}

    let pickerActive = false;

    function activatePicker() {
        if (!pickerWindow || pickerWindow.isDestroyed()) createPickerWindow();

        // 1. Instantly show the transparent window so it's ready to receive data
        pickerWindow.setOpacity(0);
        pickerWindow.show();
        pickerWindow.setAlwaysOnTop(true, 'screen-saver'); // Maximum priority

        // 2. Wrap the capture in a delay to let hover states un-click
        setTimeout(async () => {
            const cursorPoint = screen.getCursorScreenPoint();
            const currentDisplay = screen.getDisplayNearestPoint(cursorPoint);

            // 3. Size the window to cover the active display perfectly
            pickerWindow.setBounds({
                x: currentDisplay.bounds.x,
                y: currentDisplay.bounds.y,
                width: currentDisplay.bounds.width,
                height: currentDisplay.bounds.height
            });

            const localX = cursorPoint.x - currentDisplay.bounds.x;
            const localY = cursorPoint.y - currentDisplay.bounds.y;
            
            // 4. Tell the picker to clear its old data
            pickerWindow.webContents.send('reset-picker', { 
                x: localX, 
                y: localY, 
                isPro: IS_PRO_BUILD 
            });

            // 5. Calculate the exact pixel size needed for a crisp screenshot
            const thumbSize = {
                width: Math.ceil(currentDisplay.size.width * currentDisplay.scaleFactor),
                height: Math.ceil(currentDisplay.size.height * currentDisplay.scaleFactor)
            };

            try {
                // 6. Grab the screens
                const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: thumbSize });
                
                // Dynamically match the screen source to the display the user is currently on
                const source = sources.find(s => s.display_id === currentDisplay.id.toString()) || sources[0];
                
                if (source) {
                    // 7. Send the image to the picker
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

    // --- ADD THE MISSING TOGGLE FUNCTION ---
    function toggleWindow() {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.show();
                mainWindow.focus();
            }
        }
    }

    app.whenReady().then(async () => {
        // Force the app to wait for the hardware check before building the UI
        await initializeLicense(); 

        createWindow();
        createTray();
        setTimeout(createPickerWindow, 500);

        // --- MAIN WINDOW HOTKEY ---
        // Change 'Space' to 'H' or 'C' if you run SmartClip at the same time!
        globalShortcut.register('CommandOrControl+Shift+Space', () => {
            toggleWindow();
        });

        // --- COLOR PICKER HOTKEY ---
        globalShortcut.register('CommandOrControl+Alt+C', () => {
            activatePicker();
        });
    });

    app.on('will-quit', () => { globalShortcut.unregisterAll(); });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });
    
    ipcMain.on('open-external', (event, url) => {
    // Basic safety check for protocol
    if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
        shell.openExternal(url);
    }
});
    
    // --- FEATURE FLAG HANDLER ---
    ipcMain.on('dev-mode-toggle', (event, shouldBeCore) => {
        // If simulating core, force false. Otherwise, restore the true anchored status.
        IS_PRO_BUILD = shouldBeCore ? false : REAL_PRO_STATUS;
        
        // Pull the trigger
        if (mainWindow) mainWindow.reload();
    });

    ipcMain.on('get-is-pro-sync', (event) => { 
        event.returnValue = IS_PRO_BUILD; 
    });

// --- ADD DEV SYNC HERE ---
ipcMain.on('get-is-dev-sync', (event) => { 
    event.returnValue = !app.isPackaged; 
});

// --- UPDATED LICENSE VALIDATOR ---
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

        // 1. We construct the payload, but this time we inject the REAL hwId 
        // that was generated at the top of this function!
        const payloadToSave = { 
            app: 'HexStack', 
            owner: rawData.owner, 
            order_id: rawData.order_id, 
            hw_id: hwId, // <-- THE MISSING HARDWARE SEAL
            unlocked: true 
        };
        
        // 2. LicenseManager will automatically detect the real hw_id, 
        // recalculate the signature locally, and encrypt it to the disk.
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

// THE MANUAL OVERRIDE BYPASS
ipcMain.on('validate-license-string', async (event, rawJson) => {
    try {
        const tempPath = path.join(app.getPath('temp'), 'manual_license.mint');
        fs.writeFileSync(tempPath, rawJson);
        ipcMain.emit('validate-license', event, tempPath);
    } catch (e) {
        event.reply('license-response', { success: false, reason: "Manual entry failed." });
    }
});

// --- DEVELOPER SHORTCUT: NUKE LICENSE ---
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

    // --- 1. UPGRADED EXPORT ENGINE ---
    ipcMain.on('download-history', async (event, payloadStr, format) => {
        if (!IS_PRO_BUILD) return; 
        
        let ext = format || 'txt';
        let filterName = 'Text Files';

        // Set the correct labels for the OS dialogue
        if (format === 'css') filterName = 'CSS Stylesheet';
        else if (format === 'json') filterName = 'JSON File';

        try {
            // Summon the native OS save window
            const { filePath } = await dialog.showSaveDialog(mainWindow, { 
                defaultPath: `HexStack_Palette.${ext}`,
                filters: [{ name: filterName, extensions: [ext] }]
            });
            
            // If the user clicks "Save" (and doesn't cancel)
            if (filePath) {
                // Write the pre-formatted string directly to the hard drive
                fs.writeFileSync(filePath, payloadStr, 'utf-8');
                
                // Trigger the success toast
                if (mainWindow) mainWindow.webContents.send('show-notification', { title: 'Export Complete', body: `Saved as .${ext}` });
            }
        } catch (error) {
            console.error("Export failed:", error);
        }
    });
	
    ipcMain.handle('storage-get', (event, keys) => db.getBulk(keys));

    ipcMain.handle('storage-set', (event, data) => {
    // [FIX] Strict enforcement of Core limits on the backend
    if (!IS_PRO_BUILD) {
        if (data.maxItems && data.maxItems > 50) {
            data.maxItems = 50; 
        }
        // If they try to save a massive color array, truncate it
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
            
            // [FIX] Determine base width to calculate the true scale factor
            let baseW = (layoutState === 2) ? 750 : 535;
            let targetW = typeof requestedWidth === 'number' ? requestedWidth : baseW;
            let scaleFactor = targetW / baseW;

            // [FIX] Dynamically scale the minimum heights so Windows locks match the zoom
            let minH = Math.floor(160 * scaleFactor);

            if (layoutState === 2) {
                minH = Math.floor(480 * scaleFactor);
            } else if (layoutState === 1) {
                minH = Math.floor(293 * scaleFactor);
            }

            const finalH = Math.max(minH, Math.floor(newHeight));

            const currentScreen = screen.getDisplayMatching(currentBounds);
            const { height: screenHeight, y: screenY } = currentScreen.workArea; 
            
            let newY = currentBounds.y;
            const projectedBottomEdge = newY + finalH;
            const screenBottomEdge = screenY + screenHeight; 

            if (projectedBottomEdge > screenBottomEdge) {
                newY = screenBottomEdge - finalH;
            }
            if (newY < screenY) {
                newY = screenY;
            }

            // 1. Temporarily unclamp limits so Windows and Chromium don't fight
            mainWindow.setMinimumSize(1, 1);
            mainWindow.setMaximumSize(9999, 9999);
            
            // 2. Safely apply the exact new bounds
            mainWindow.setBounds({ 
                x: currentBounds.x, 
                y: newY, 
                width: targetW, 
                height: finalH 
            }, true);

            // 3. Immediately re-apply the strict stretch locks
            mainWindow.setMinimumSize(targetW, minH);
            mainWindow.setMaximumSize(targetW, 9999);
        }
    });

    ipcMain.on('set-ui-zoom', (event, factor) => {
        if (mainWindow) mainWindow.webContents.setZoomFactor(factor);
    });

   // --- [FIX 1] BULLETPROOF ALWAYS-ON-TOP ---
    ipcMain.on('set-always-on-top', (event, state) => {
    isAlwaysOnTop = state;
    // THE FIX: Only assert "Top" if the window is actually visible
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) { 
        mainWindow.setAlwaysOnTop(state, 'pop-up-menu');
        if (state) mainWindow.moveTop();
    }
});

    // --- [FIX 2] SINGLE-FIRE NOTIFICATIONS ---
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
            // Re-assert top-level dominance when returning from the picker
            if (isAlwaysOnTop) mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
            mainWindow.focus(); 
        }
    });

    ipcMain.on('toggle-startup', (event, isEnabled) => {
    db.set('launchOnStartup', isEnabled);

    // THE SHIELD: Only register to Windows if compiled into an actual .exe
    if (app.isPackaged) {
        app.setLoginItemSettings({
            openAtLogin: isEnabled,
            path: app.getPath('exe'), 
            args: ['--hidden']
        });
    } else {
        console.log("🛠️ DEV MODE: Bypassing Windows startup registry.");
    }
});
} // <-- Keep this final closing bracket!