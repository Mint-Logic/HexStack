// ColorMath.js

export const ColorMath = {
    parseAnyInput: (input) => {
        const str = input.replace(/\s+/g, '').toLowerCase(); 
        const hexMatch = str.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hexMatch) return ColorMath.normalizeHex(hexMatch[0]);
        const rgbMatch = str.match(/^rgba?\((\d+),(\d+),(\d+)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]), g = parseInt(rgbMatch[2]), b = parseInt(rgbMatch[3]);
            if (r<=255 && g<=255 && b<=255) return "#" + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('').toUpperCase();
        }
        const hslMatch = str.match(/^hsl\((\d+),(\d+)%?,(\d+)%?\)/);
        if (hslMatch) return ColorMath.hslToHex(parseInt(hslMatch[1]), parseInt(hslMatch[2]), parseInt(hslMatch[3]));
        const hsvMatch = str.match(/^hsva?\((\d+),(\d+)%?,(\d+)%?/);
        if (hsvMatch) return ColorMath.hsvToHex(parseInt(hsvMatch[1]), parseInt(hsvMatch[2]), parseInt(hsvMatch[3]));
        const argbMatch = str.match(/^0xff([0-9a-f]{6})$/i);
        if (argbMatch) return "#" + argbMatch[1].toUpperCase();
        return null; 
    },

    getContrastColor: (hex) => {
        const luminance = ColorMath.getLuminance(hex);
        return luminance > 0.5 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.1)';
    },

    normalizeHex: (hex) => {
        if (!hex) return "#000000";
        let h = hex.replace('#', '');
        if (h.length === 3) h = h.split('').map(char => char + char).join('');
        return `#${h.toUpperCase()}`;
    },

    hexToRgb: (hex) => {
        const fullHex = ColorMath.normalizeHex(hex);
        const r = parseInt(fullHex.slice(1, 3), 16) || 0;
        const g = parseInt(fullHex.slice(3, 5), 16) || 0;
        const b = parseInt(fullHex.slice(5, 7), 16) || 0;
        return { r, g, b, str: `rgb(${r}, ${g}, ${b})`, arr: [r, g, b] };
    },

    hexToRgba: (hex) => {
        const { r, g, b } = ColorMath.hexToRgb(hex);
        return `rgba(${r}, ${g}, ${b}, 1)`;
    },

    hexToHsl: (hex) => {
        let { r, g, b } = ColorMath.hexToRgb(hex);
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) h = s = 0;
        else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) { 
                case r: h = (g - b) / d + (g < b ? 6 : 0); break; 
                case g: h = (b - r) / d + 2; break; 
                case b: h = (r - g) / d + 4; break; 
            }
            h /= 6;
        }
        const hVal = Math.round(h * 360), sVal = Math.round(s * 100), lVal = Math.round(l * 100);
        return { h: hVal, s: sVal, l: lVal, str: `hsl(${hVal}, ${sVal}%, ${lVal}%)`, arr: [hVal, sVal, lVal] };
    },

    hslToHex: (h, s, l) => {
        l /= 100; s /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
    },

    hexToHsv: (hex) => {
        let { r, g, b } = ColorMath.hexToRgb(hex);
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) h = 0;
        else {
            switch (max) { 
                case r: h = (g - b) / d + (g < b ? 6 : 0); break; 
                case g: h = (b - r) / d + 2; break; 
                case b: h = (r - g) / d + 4; break; 
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    },

    hsvToHex: (h, s, v) => {
        s /= 100; v /= 100;
        const i = Math.floor(h / 60);
        const f = h / 60 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        let r, g, b;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        return "#" + [r, g, b].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
    },

    hexToHsva: (hex) => {
        const hsv = ColorMath.hexToHsv(hex);
        return `hsva(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%, 1)`;
    },

    hexToCmyk: (hex) => {
        let { r, g, b } = ColorMath.hexToRgb(hex);
        r /= 255; g /= 255; b /= 255;
        let k = 1 - Math.max(r, g, b);
        if (k === 1) return { str: "cmyk(0%, 0%, 0%, 100%)", arr: [0, 0, 0, 100] };
        let c = Math.round((1 - r - k) / (1 - k) * 100);
        let m = Math.round((1 - g - k) / (1 - k) * 100);
        let y = Math.round((1 - b - k) / (1 - k) * 100);
        return { str: `cmyk(${c}%, ${m}%, ${y}%, ${Math.round(k * 100)}%)`, arr: [c, m, y, Math.round(k * 100)] };
    },

    hexToArgb: (hex) => {
        const fullHex = ColorMath.normalizeHex(hex);
        return `0xFF${fullHex.slice(1)}`;
    },

    getLuminance: (hex) => {
        const { r, g, b } = ColorMath.hexToRgb(hex);
        const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    },

    getAccessibility: (hex) => {
        const L1 = ColorMath.getLuminance(hex);
        const L_White = 1.0;
        const L_Black = 0.0;
        const vsW = (L_White + 0.05) / (L1 + 0.05);
        const vsB = (L1 + 0.05) / (L_Black + 0.05);
        return { 
            white: { ratio: vsW.toFixed(2), pass: vsW >= 4.5 ? 'PASS' : 'FAIL' }, 
            black: { ratio: vsB.toFixed(2), pass: vsB >= 4.5 ? 'PASS' : 'FAIL' } 
        };
    },

    getHue: (hex) => ColorMath.hexToHsl(hex).arr[0],

    getShade: (hex, percent) => {
        let { r, g, b } = ColorMath.hexToRgb(hex);
        const adj = (val) => Math.round(Math.min(Math.max(0, val + (val * percent)), 255));
        return "#" + [adj(r), adj(g), adj(b)].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
};