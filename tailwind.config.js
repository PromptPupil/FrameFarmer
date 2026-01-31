/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-primary': '#1a1a1a',
        'bg-secondary': '#242424',
        'bg-tertiary': '#2d2d2d',
        'text-primary': '#e0e0e0',
        'text-secondary': '#a0a0a0',
        'accent': '#3b82f6',
        'accent-hover': '#60a5fa',
        'success': '#22c55e',
        'warning': '#f59e0b',
        'error': '#ef4444',
        'border': '#404040',
        'frame-selected': '#3b82f6',
        'frame-hover': '#404040',
        'frame-blurry': '#f59e0b',
        'frame-duplicate': '#8b5cf6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
