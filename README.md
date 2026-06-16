# HexStack

A precision color pick workspace and validation utility engineered to bridge the gap between creative visual selection and strict front-end web design compliance.

## Features
* **Macro Lens Magnification:** Deploys a 40x micro-lens overlay that tracks cursor coordinates perfectly using an offscreen coordinate-offset system anchored across uneven multi-monitor DPI scalings.
* **WCAG Compliance Validation:** Automatically audits selected color combinations against Web Content Accessibility Guidelines (WCAG) 2.1 contrast parameters, spitting out dynamic contrast ratios and legibility passes.
* **Inclusive Vision Emulation:** Simulates real-time optics for Protanopia, Deuteranopia, and Tritanopia color blindness paradigms directly over the color selection matrix.
* **Developer Code Handoff:** Formats swatches instantly into HEX, RGB, HSL, HSV, CMYK, or ARGB color formats, with batch export capabilities to roll custom variable structures down to raw CSS variables (`:root`) or structured JSON files.

## Architecture
HexStack maps a continuous pixel-grab loop by combining a hidden desktop display mirror capture with an independent viewport magnifier logic loop. It avoids rendering stutters on high-refresh monitor targets through optimized coordinate translation arrays.

## Development & Installation

```bash
# Install dependencies
npm install

# Run application
npm start
