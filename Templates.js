// Templates.js

export const Templates = {
    getAboutHtml: function(IS_PRO_BUILD, IS_DEV) {
        return `
<div class="guide-content">
    <div class="guide-header" style="display: flex; justify-content: space-between; align-items: center; padding-right: 15px;">
        <h2><i class="fa-solid fa-swatchbook"></i> HexStack Settings</h2>
        
        <button id="closeHelpBtn" style="position: relative; z-index: 9999; -webkit-app-region: no-drag; pointer-events: auto; background: transparent; border: 1px solid var(--brdr); color: var(--muted); cursor: pointer; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 4px; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); margin: 0;">
            Close
        </button>
    </div>

    <div class="settings-body">
        <div class="settings-sidebar">
            <div class="sidebar-section">Configuration</div>
            <button class="tab-btn active" data-tab="tab-about"><i class="fa-solid fa-circle-info"></i> About</button>
            <button class="tab-btn" data-tab="tab-prefs"><i class="fa-solid fa-sliders"></i> Preferences</button>
            
            <div class="sidebar-section">User Guide</div>
            <button class="tab-btn" data-tab="guide-workflow"><i class="fa-solid fa-crosshairs"></i> Workflow</button>
            ${IS_PRO_BUILD ? `<button class="tab-btn" data-tab="guide-pro"><i class="fa-solid fa-wand-magic-sparkles"></i> Pro Tools</button>` : ''}
            <button class="tab-btn" data-tab="guide-hotkeys"><i class="fa-solid fa-keyboard"></i> Shortcuts</button>
        </div>

        <div class="settings-main">
            
            <div id="tab-about" class="tab-pane active">
                <div style="text-align: center; padding: 0px 0 10px 0;">
                    <img src="icon.png" style="width: 60px; height: 60px; margin-top: 0px; margin-bottom: 0px;">
                   <div style="font-family:'Orbitron', sans-serif; font-size: 20px; font-weight: 900; color: #fff;">
    <span style="position: relative; display: inline-block;">
        <span style="color:var(--accent)">Hex</span>Stack
        <span class="edition-label ${IS_PRO_BUILD ? 'pro' : 'core'}" style="font-size:9px; position: absolute; left: 100%; top: 0; margin-left: 4px;">${IS_PRO_BUILD ? 'PRO' : 'CORE'}</span>
    </span>
</div>
                    <div style="font-size: 11px; color: #777; margin-top: 0px;">Version 1.0.0</div>
                    
                    ${!IS_PRO_BUILD ? `
<div style="font-size: 11px; color: var(--accent); border: 1px dashed var(--accent); padding: 6px 15px; border-radius: 4px; opacity: 0.8; text-align: center; margin: 8px auto 10px auto; max-width: 300px;">
    <i class="fa-solid fa-file-import"></i> Drag & Drop your <b>.mint</b> file to unlock Pro
</div>
` : ''}
                    
                    <div style="margin-top: 8px; display:flex; gap:10px; justify-content:center; align-items: center;">
                        <button id="btnCheckUpdates" style="height: 24px; display: flex; align-items: center; justify-content: center; gap: 5px; background:transparent; border:1px solid var(--accent); color:var(--accent); padding:0 12px; border-radius:4px; cursor:pointer; font-size:11px; transition: 0.2s; text-transform: none;"><i class="fa-solid fa-rotate"></i> Updates</button>
                       
                        ${!IS_PRO_BUILD ? `
                        <button id="btnUpgradePro" style="height: 24px; display: flex; align-items: center; justify-content: center; gap: 5px; background:var(--mint); border:none; color:#1e1e1e; font-weight:bold; padding:0 12px; border-radius:4px; cursor:pointer; font-size:11px; transition: 0.2s; text-transform: none;"><i class="fa-solid fa-rocket"></i> Get Key</button>
                        ` : ''}
                    </div>

                    <p style="color:#ccc; font-size:12px; max-width:425px; margin: 15px auto 5px auto; line-height: 1.5;">
                        HexStack is a high-performance continuous color picker and palette manager. Extract pixel-perfect colors, validate accessibility, and generate harmonious palettes instantly without breaking your workflow.
                    </p>

                    <div style="display:flex; gap:20px; justify-content:center; margin-top: 10px; font-size: 11px; color: #aaa;">
                        <span title="Stored safely on your device"><i class="fa-solid fa-hard-drive"></i> Local Storage</span>
                        <span title="Zero telemetry, strictly offline"><i class="fa-solid fa-wifi"></i> 100% Offline</span>
                    </div>
                </div>

                <div class="setting-group" style="border-top: 1px solid #333; padding-top: 0px; padding-bottom: 0px; margin-top: 8px; margin-bottom: 10px;">
                    <div class="g-item" style="grid-column: 1 / -1;">
                        <strong><i class="fa-solid fa-shield-halved"></i> Zero-Telemetry Policy</strong>
                        HexStack operates strictly offline. We do not track usage or collect analytics. Your canvas, data, and captures never leave your local hardware. The only time HexStack connects to the internet is a single, one-time ping during Pro activation to verify your license.
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 8px;">
                    <img src="mint_logic.png" alt="Mint Logic LLC" style="width: 120px; height: auto;">
                    <div style="margin-top: 8px; font-size: 10px; color: #666; letter-spacing: 0.5px;">
                        &copy; 2026 Mint Logic, LLC. All rights reserved.
                    </div>
                </div>
            </div>

            <div id="tab-prefs" class="tab-pane">
            ${IS_DEV ? `
                <div class="setting-group" style="padding: 10px; border-radius: 6px; margin-bottom: 20px; background: rgba(255, 0, 127, 0.05); border: 1px dashed #FF007F;">
                    <div class="st-title" style="color: #FF007F; margin-bottom: 5px;"><i class="fa-solid fa-bug"></i> Developer Override</div>
                    <div class="setting-row" style="margin-bottom: 0;">
                        <div class="setting-label" style="color: #FF007F;">Simulate Core Mode <div class="setting-desc" style="color: rgba(255, 255, 255, 0.5);">Force-disable Pro features for UI testing.</div></div>
                        <label class="switch dev-switch" style="transform:scale(0.8); margin:0;">
                            <input type="checkbox" id="devCoreToggle">
                            <span class="slider" style="background: #333;"></span>
                        </label>
                    </div>
                </div>
            ` : ''}
                <div class="setting-group">
                    <div class="st-title">Application Behavior</div>
                    <div class="setting-row">
                        <div class="setting-label">Always On Top <div class="setting-desc">Keep window floating above other apps.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="alwaysOnTopToggle"><span class="slider"></span></label>
                    </div>
                    <div class="setting-row">
    <div class="setting-label">Launch on Startup <div class="setting-desc">Load HexStack silently to the tray at boot.</div></div>
    <label class="switch" style="transform:scale(0.8); margin:0;">
        <input type="checkbox" id="startupToggle">
        <span class="slider"></span>
    </label>
</div>
                    <div class="setting-row">
                        <div class="setting-label">System Notifications <div class="setting-desc">Show OS alerts upon successful extraction.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="notifyToggle"><span class="slider"></span></label>
                    </div>
                    <div class="setting-row">
                        <div class="setting-label">Hover Tooltips <div class="setting-desc">Display descriptive labels over buttons.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="guideTooltipToggle"><span class="slider"></span></label>
                    </div>                  
                    <div class="setting-row">
                        <div class="setting-label">UI Scale <div class="setting-desc">Adjust the global interface size.</div></div>
                        <select id="uiScaleSelect" style="background:#1e1e1e; border:1px solid #444; color:#fff; padding:4px 8px; border-radius:4px; font-size:11px;">
                            <option value="1">Normal (100%)</option>
                            <option value="1.15">Large (115%)</option>
                            <option value="1.25">Extra Large (125%)</option>
                        </select>
                    </div>
                </div>

                <div class="setting-group">
                    <div class="st-title">Data Management</div>
                    <div class="setting-row">
                        <div class="setting-label">History Limit <div class="setting-desc">Max swatches kept in memory before overwriting.</div></div>
                        <div style="display:flex; align-items:center; gap:5px;">
    <button id="spinDown"><i class="fa-solid fa-minus"></i></button>
    <input type="number" id="maxItems" value="50">
    <button id="spinUp"><i class="fa-solid fa-plus"></i></button>
</div>
                    </div>
                    <div class="setting-row">
                        <div class="setting-label">Default Code Format <div class="setting-desc">Format used when copying to the clipboard.</div></div>
                        <select id="defaultCodeType" style="background:#1e1e1e; border:1px solid #444; color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; ${!IS_PRO_BUILD ? 'appearance:none; -webkit-appearance:none; text-align:center; padding-right:8px;' : ''}">
                            <option value="HEX">HEX</option>
    <option value="RGB">RGB</option>
    <option value="RGBA">RGBA</option>
    <option value="HSL">HSL</option>
    <option value="HSV">HSV</option>
    <option value="HSVA">HSVA</option>
    <option value="CMYK">CMYK</option>
    <option value="ARGB">ARGB</option>
                        </select>
                    </div>
                    <div class="setting-row">
                        <div class="setting-label">Compact View <div class="setting-desc">Reduce row height to fit more colors on screen.</div></div>
                        <label class="switch" style="transform:scale(0.8); margin:0;"><input type="checkbox" id="compactToggle"><span class="slider"></span></label>
                    </div>
                </div>
            </div>

            <div id="guide-workflow" class="tab-pane">
                <div class="setting-group">
                    <div class="st-title">Extraction & Management</div>
                    <div class="g-grid">
                        <div class="g-item">
                            <strong><i class="fa-solid fa-eye-dropper"></i> Screen Extraction</strong>
                            Click the glowing eyedropper to activate the crosshair. Click any pixel on your monitor to extract its code. <span style="color:var(--accent)">Right-Click</span> or press <span style="color:var(--accent)">Esc</span> to cancel.
                        </div>
                        <div class="g-item">
                            <strong><i class="fa-solid fa-keyboard"></i> Manual Injection</strong>
                            Know the code? Press <span style="color:var(--accent)">S</span> to focus the top input bar, type it in, and press Enter to instantly inject it into your palette stack.
                        </div>
                        <div class="g-item" ${!IS_PRO_BUILD ? 'style="grid-column: 1 / -1;"' : ''}>
                            <strong><i class="fa-solid fa-star"></i> Pinning & Deletion</strong>
                            Click the star icon to permanently protect a color from being pushed off the stack. Click the Trash icon to delete, or click "Clear All" to remove all unpinned colors.
                        </div>
                        ${IS_PRO_BUILD ? `
                        <div class="g-item">
                            <strong><i class="fa-solid fa-terminal"></i> Terminal Recovery</strong>
                            Accidentally deleted a color? Open the System Terminal Log via the gear icon. Click any hex code in the log history to instantly recover it.
                        </div>
                        <div class="g-item" style="grid-column: 1 / -1;">
                            <strong><i class="fa-solid fa-check-double"></i> Batch Exporting</strong>
                            Use the checkboxes on the left to select multiple colors, then click "Export" to save them as a .TXT, .CSS, or .JSON file, or copy them simultaneously.
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>

            ${IS_PRO_BUILD ? `
            <div id="guide-pro" class="tab-pane">
    <div class="setting-group">
        <div class="st-title">Advanced Color Math</div>
        <div class="g-grid">
            <div class="g-item" style="grid-column: 1 / -1;">
                <strong><i class="fa-solid fa-sliders"></i> Tweak & Refine</strong>
                Open the Tweak panel to fine-tune Hue, Saturation, and Lightness. HexStack preserves your original swatch for side-by-side comparison until you commit the change.
            </div>
            <div class="g-item">
                <strong><i class="fa-solid fa-circle-half-stroke"></i> WCAG A11y Audit</strong>
                Instantly validate text legibility. Pro calculates contrast ratios, provides a Pass/Fail rating based on WCAG 4.5:1 standards, and lets you swap foreground/background to test colored text on Light/Dark modes.
            </div>
            <div class="g-item">
                <strong><i class="fa-solid fa-diagram-project"></i> Triadic Harmony</strong>
                Automatically generate balanced complementary colors (120° apart). Perfect for finding accent colors that mathematically "fit" your primary brand hue.
            </div>
            <div class="g-item">
                <strong><i class="fa-solid fa-eye"></i> Inclusive Vision</strong>
                Preview your swatches through Protanopia, Deuteranopia, and Tritanopia simulators to ensure your UI remains accessible to color-blind users.
            </div>
        </div>
    </div>
</div>
            ` : ''}

            <div id="guide-hotkeys" class="tab-pane">
                <div class="st-title" style="margin-top: 0;">System Shortcuts</div>
                <div class="g-grid" style="grid-template-columns: 1fr; gap: 8px;">
                     <div class="g-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;">
                        <span>Toggle App Visibility</span>
                        <span class="k-badge">Ctrl + Shift + Space</span>
                     </div>
                     <div class="g-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;">
                        <span>Activate Eyedropper</span>
                        <span class="k-badge">Ctrl + Alt + C</span>
                     </div>
                     <div class="g-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;">
                        <span>Focus Search/Inject Bar</span>
                        <span class="k-badge">S</span>
                     </div>
                     <div class="g-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;">
                        <span>Copy Selected</span>
                        <span class="k-badge">Enter</span>
                     </div>
                     <div class="g-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px;">
                        <span>Cancel Eyedropper</span>
                        <span class="k-badge">Esc / Right-Click</span>
                     </div>
                </div>
            </div>

        </div>
    </div>
</div>
`;
    }
};