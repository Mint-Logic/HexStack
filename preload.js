const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hexStack', {
devModeToggle: (val) => ipcRenderer.send('dev-mode-toggle', val),
    // --- Window Controls ---
    minimize: () => ipcRenderer.send('minimize-window'),
    close: () => ipcRenderer.send('close-app'),
    resize: (height, isSettingsOpen, forceWidth) => ipcRenderer.send('resize-window', height, isSettingsOpen, forceWidth),
    dragResize: (width) => ipcRenderer.send('drag-resize', width),
    setAlwaysOnTop: (bool) => ipcRenderer.send('set-always-on-top', bool),
  
    // --- System ---
    openExternal: (url) => ipcRenderer.send('open-external', url),
    showNotification: (title, body) => ipcRenderer.send('show-notification', { title, body }),
    setZoom: (factor) => ipcRenderer.send('set-ui-zoom', factor),

    send: (channel, data) => {
        const validChannels = ['toggle-startup']; // Security: only allow this specific channel
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },

    // --- Data / Storage ---
    storageGet: (keys) => ipcRenderer.invoke('storage-get', keys),
    storageSet: (data) => ipcRenderer.invoke('storage-set', data),

    // --- Core Features ---
    activatePicker: () => ipcRenderer.send('activate-picker'),
    downloadHistory: (items, format) => ipcRenderer.send('download-history', items, format),
        
    // [NEW] LICENSE BRIDGE
    validateLicense: (key) => ipcRenderer.send('validate-license', key),
    validateLicenseString: (keyStr) => ipcRenderer.send('validate-license-string', keyStr), // <--- ADD THIS

    // [NEW] Synchronous check for Pro status
    getIsProSync: () => ipcRenderer.sendSync('get-is-pro-sync'),
    getIsDevSync: () => ipcRenderer.sendSync('get-is-dev-sync'),

    // --- Events (Renderer) ---
    onPickedColor: (callback) => ipcRenderer.on('picked-color', (e, hex) => callback(hex)),
    onInitStatus: (callback) => ipcRenderer.on('init-status', (e, isPro) => callback(isPro)),
        
    // [NEW] LICENSE LISTENER
    onLicenseResponse: (callback) => ipcRenderer.on('license-response', (e, res) => callback(res)),

    // --- Picker Window Specifics ---
    pickerReady: () => ipcRenderer.send('picker-ready'),
    cancelPicker: () => ipcRenderer.send('cancel-picker'),
    colorSelected: (hex) => ipcRenderer.send('color-selected', hex),
    onResetPicker: (callback) => ipcRenderer.on('reset-picker', (e, data) => callback(data)),
    onScreenCapture: (callback) => ipcRenderer.on('screen-capture', (event, data) => callback(data))
});