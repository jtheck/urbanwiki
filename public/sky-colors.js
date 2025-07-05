// Sky Colors Utility - Handles timezone calculations and smooth color transitions

class SkyColors {
  constructor() {
    // Define 24 sky colors (one for each hour) - Smooth day-night cycle
    this.skyColors = [
      // Midnight to 6 AM - Night cycle (smooth progression)
      { hour: 0, header: '#0A0A0F', background: '#0A0A0F', name: 'Deep Night' },
      { hour: 1, header: '#0A0A0F', background: '#0A0A0F', name: 'Late Night' },
      { hour: 2, header: '#0F0F1A', background: '#0F0F1A', name: 'Night' },
      { hour: 3, header: '#0F0F1A', background: '#0F0F1A', name: 'Early Night' },
      { hour: 4, header: '#1A0F0A', background: '#1A0F0A', name: 'Pre-Dawn' },
      { hour: 5, header: '#2A1A0A', background: '#2A1A0A', name: 'Early Dawn' },
      
      // 6 AM to 12 PM - Morning cycle (smooth sunrise progression)
      { hour: 6, header: '#3A2A1A', background: '#3A2A1A', name: 'Dawn' },
      { hour: 7, header: '#5A3A2A', background: '#5A3A2A', name: 'Early Sunrise' },
      { hour: 8, header: '#8A5A3A', background: '#8A5A3A', name: 'Sunrise' },
      { hour: 9, header: '#B0D0E0', background: '#B0D0E0', name: 'Early Morning' },
      { hour: 10, header: '#A0C0D0', background: '#A0C0D0', name: 'Morning' },
      { hour: 11, header: '#90B0C0', background: '#90B0C0', name: 'Late Morning' },
      
      // 12 PM to 6 PM - Afternoon cycle (smooth day progression - more blue)
      { hour: 12, header: '#E8F4FD', background: '#E8F4FD', name: 'Noon' },
      { hour: 13, header: '#D0E8FD', background: '#D0E8FD', name: 'Early Afternoon' },
      { hour: 14, header: '#B8DCFD', background: '#B8DCFD', name: 'Afternoon' },
      { hour: 15, header: '#A0D0FD', background: '#A0D0FD', name: 'Late Afternoon' },
      { hour: 16, header: '#88C4FD', background: '#88C4FD', name: 'Golden Hour' },
      { hour: 17, header: '#FFE6CC', background: '#FFE6CC', name: 'Late Golden Hour' },
      
      // 6 PM to 12 AM - Evening cycle (smooth sunset progression)
      { hour: 18, header: '#FFE6D6', background: '#FFE6D6', name: 'Sunset' },
      { hour: 19, header: '#FFE6D6', background: '#FFE6D6', name: 'Dusk' },
      { hour: 20, header: '#2A1A0A', background: '#2A1A0A', name: 'Early Evening' },
      { hour: 21, header: '#1A0F0A', background: '#1A0F0A', name: 'Evening' },
      { hour: 22, header: '#0F0F1A', background: '#0F0F1A', name: 'Late Evening' },
      { hour: 23, header: '#0A0A0F', background: '#0A0A0F', name: 'Night' }
    ];
    
    // Debouncing for zoom stability
    this.lastUpdateTime = 0;
    this.updateInterval = 50; // Reduced from 100ms to 50ms for more responsiveness
  }

  // Calculate timezone offset from longitude with proper wrapping
  getTimezoneFromLongitude(longitude) {
    // Handle longitude wrapping at the International Date Line
    let wrappedLongitude = longitude;
    
    // Normalize longitude to -180 to +180 range
    while (wrappedLongitude > 180) {
      wrappedLongitude -= 360;
    }
    while (wrappedLongitude < -180) {
      wrappedLongitude += 360;
    }
    
    // Shift prime meridian westward by 30 degrees (2 hours)
    // This makes timezone calculations more accurate to real-world boundaries
    const adjustedLongitude = wrappedLongitude + 30;
    
    // Calculate timezone offset (roughly 15° per hour)
    const timezoneOffset = Math.round(adjustedLongitude / 15);
    
    // Clamp timezone to valid range (-12 to +14)
    return Math.max(-12, Math.min(14, timezoneOffset));
  }

  // Get local time in a specific timezone
  getLocalTimeInTimezone(timezoneOffset) {
    const now = new Date();
    const userHour = now.getHours();
    const userTimezoneOffset = now.getTimezoneOffset() / 60; // Convert minutes to hours
    let localHour = (userHour + timezoneOffset + userTimezoneOffset) % 24;
    if (localHour < 0) localHour += 24;
    return localHour;
  }

  // Convert hex color to RGB
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  // Convert RGB to hex
  rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Convert hex color to HSL
  hexToHsl(hex) {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return null;
    
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  // Convert HSL to hex
  hslToHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let r, g, b;
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = (c) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  // Interpolate between two colors using HSL for smoother transitions
  interpolateColors(color1, color2, factor) {
    const hsl1 = this.hexToHsl(color1);
    const hsl2 = this.hexToHsl(color2);
    
    if (!hsl1 || !hsl2) {
      // Fallback to RGB interpolation if HSL conversion fails
      const rgb1 = this.hexToRgb(color1);
      const rgb2 = this.hexToRgb(color2);
      
      const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
      const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
      const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);
      
      return this.rgbToHex(r, g, b);
    }
    
    // Handle hue interpolation (shortest path around the color wheel)
    let h1 = hsl1.h, h2 = hsl2.h;
    if (Math.abs(h2 - h1) > 180) {
      if (h2 > h1) {
        h1 += 360;
      } else {
        h2 += 360;
      }
    }
    
    const h = (h1 + (h2 - h1) * factor) % 360;
    const s = hsl1.s + (hsl2.s - hsl1.s) * factor;
    const l = hsl1.l + (hsl2.l - hsl1.l) * factor;
    
    return this.hslToHex(h, s, l);
  }

  // Get smooth sky colors based on exact time
  getSkyColors(longitude) {
    const timezoneOffset = this.getTimezoneFromLongitude(longitude);
    const localHour = this.getLocalTimeInTimezone(timezoneOffset);
    
    // Find the two colors to interpolate between
    const hour1 = Math.floor(localHour);
    const hour2 = (hour1 + 1) % 24;
    const factor = localHour - hour1; // 0.0 to 1.0
    
    // Get the two sky color objects
    const color1 = this.skyColors.find(c => c.hour === hour1);
    const color2 = this.skyColors.find(c => c.hour === hour2);
    
    // Interpolate header and background colors
    const headerColor = this.interpolateColors(color1.header, color2.header, factor);
    const backgroundColor = this.interpolateColors(color1.background, color2.background, factor);
    
    return {
      headerColor,
      backgroundColor,
      timezoneOffset,
      localHour,
      timeName: color1.name
    };
  }

  // Get smooth sky colors with easing for better transitions
  getSmoothSkyColors(longitude, lastColors = null) {
    const now = Date.now();
    
    // Debounce rapid updates during zoom
    if (now - this.lastUpdateTime < this.updateInterval) {
      return lastColors || this.getSkyColors(longitude);
    }
    
    const newColors = this.getSkyColors(longitude);
    this.lastUpdateTime = now;
    
    // If we have previous colors, apply easing for smoother transitions
    if (lastColors) {
      const easingFactor = 0.25; // Increased from 0.15 for more responsiveness
      
      newColors.headerColor = this.interpolateColors(
        lastColors.headerColor, 
        newColors.headerColor, 
        easingFactor
      );
      newColors.backgroundColor = this.interpolateColors(
        lastColors.backgroundColor, 
        newColors.backgroundColor, 
        easingFactor
      );
    }
    
    return newColors;
  }

  // Apply colors to DOM elements with smooth transitions
  applyColors(colors) {
    const header = document.querySelector('#header');
    if (header) {
      // Use CSS transitions for smoother color changes
      header.style.transition = 'background-color 0.8s ease-out';
      header.style.backgroundColor = colors.headerColor;
    }
    
    // Don't change the page background - keep it static
    // document.body.style.transition = 'background-color 0.8s ease-out';
    // document.body.style.backgroundColor = colors.backgroundColor;
    
    // Log for debugging (only if colors changed significantly)
    if (!this.lastAppliedColors || 
        this.lastAppliedColors.headerColor !== colors.headerColor) {
      // console.log(`Timezone: ${colors.timezoneOffset}, Local hour: ${colors.localHour.toFixed(2)}, Time: ${colors.timeName}, Header: ${colors.headerColor}`);
      this.lastAppliedColors = colors;
    }
  }

  // Reset debouncing timer (call this when zoom operations complete)
  resetDebounce() {
    this.lastUpdateTime = 0;
  }
}

// Export for use in other files
window.SkyColors = SkyColors; 