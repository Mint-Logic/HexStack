// UIManager.js

export const UIManager = {
    tipTimeout: null,

    showTip: (el, txt, autoHide = true) => { 
        if(!el) return;
        const tip = document.getElementById('floatingTip');
        if (!autoHide && tip.classList.contains('show') && tip.textContent === txt) {
            tip.classList.remove('show');
            return;
        }
        if (UIManager.tipTimeout) clearTimeout(UIManager.tipTimeout);

        tip.textContent = txt; 
        tip.classList.add('show'); 
        
        const rect = el.getBoundingClientRect();
        const tipRect = tip.getBoundingClientRect();
        const winW = window.innerWidth;
        const padding = 10;
        
        let left = rect.left + (rect.width / 2) - (tipRect.width / 2);
        if (left < padding) left = padding;
        if (left + tipRect.width > winW - padding) left = winW - tipRect.width - padding;
        
        let top = rect.top - tipRect.height - 8;
        if (top < padding) top = rect.bottom + 8;
        
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
        
        if (autoHide) {
            UIManager.tipTimeout = setTimeout(() => tip.classList.remove('show'), 1000);
        }
    },

    initTooltips: (getSettingsFn) => {
        const tooltip = document.querySelector('.custom-tooltip') || document.createElement('div');
        if(!document.body.contains(tooltip)) {
            tooltip.className = 'custom-tooltip';
            document.body.appendChild(tooltip);
        }

        document.addEventListener('mouseover', (e) => {
            const t = e.target.closest('[title], [data-tip]');
            if (t) {
                if (t.hasAttribute('title')) {
                    t.dataset.tip = t.getAttribute('title');
                    t.removeAttribute('title');
                }

                const settings = getSettingsFn();
                if (settings.tooltipsEnabled !== false) {
                    tooltip.textContent = t.dataset.tip;
                    tooltip.classList.add('visible');

                    const targetRect = t.getBoundingClientRect();
                    const tipRect = tooltip.getBoundingClientRect();
                    const winW = window.innerWidth;
                    const winH = window.innerHeight;
                    const gap = 8; 
                    const padding = 10; 

                    let left = targetRect.left + (targetRect.width / 2) - (tipRect.width / 2);
                    if (left < padding) left = padding;
                    if (left + tipRect.width > winW - padding) left = winW - tipRect.width - padding;

                    let top = targetRect.bottom + gap;
                    if (top + tipRect.height > winH - padding) {
                        top = targetRect.top - tipRect.height - gap;
                    }

                    tooltip.style.left = left + 'px';
                    tooltip.style.top = top + 'px';
                }
            }
        });

        document.addEventListener('mouseout', (e) => {
            const t = e.target.closest('[data-tip]');
            if(t) { 
                t.title = t.dataset.tip; 
                tooltip.classList.remove('visible'); 
            }
        });
    },

    initSettingsTabs: (helpModal) => {
        if (!helpModal) return;
        const tabBtns = helpModal.querySelectorAll('.tab-btn');
        const tabPanes = helpModal.querySelectorAll('.tab-pane');
        
        tabBtns.forEach(btn => {
            btn.onclick = () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                helpModal.querySelector(`#${btn.dataset.tab}`).classList.add('active');
            };
        });
    },

    initDragAndDropUI: (dropzone, onFileDrop) => {
        if (!dropzone) return;
        let dragCounter = 0; 

        window.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (e.dataTransfer.types.includes('Files')) {
                dragCounter++;
                dropzone.classList.add('drag-active');
            }
        });

        window.addEventListener('dragover', (e) => e.preventDefault());

        window.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                dropzone.classList.remove('drag-active');
            }
        });

        window.addEventListener('drop', async (e) => {
            e.preventDefault();
            dragCounter = 0;
            dropzone.classList.remove('drag-active');

            const files = e.dataTransfer.files;
            if (files && files.length > 0) onFileDrop(files[0]);
        });
    }
};