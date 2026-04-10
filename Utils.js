// Utils.js

export const Utils = {
    debounce: (func, wait) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    escapeHTML: (str) => {
        if (!str) return "";
        return str.replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    },

    showSystemToast: (msg, success = true) => {
        let toast = document.getElementById('sysToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'sysToast';
            document.body.appendChild(toast);
        }
        toast.className = ''; 
        toast.innerHTML = success 
            ? `<i class="fa-solid fa-circle-check"></i> ${msg}`
            : `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
        if (!success) toast.classList.add('error');
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};