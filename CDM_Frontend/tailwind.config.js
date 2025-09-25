/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'ag-dark': {
          'bg': '#1F2836',
          'surface': '#2A3441',
          'border': '#3D4754',
          'text': '#FFFFFF',
          'text-secondary': '#B0BCC9',
          'accent': '#2196F3',
          'accent-hover': '#1976D2',
          'success': '#4CAF50',
          'warning': '#FF9800',
          'error': '#F44336',
        }
      },
      fontFamily: {
        'sans': ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};