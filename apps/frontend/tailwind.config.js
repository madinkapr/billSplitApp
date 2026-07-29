/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        accent: { DEFAULT: '#6C5CE7', tint: '#EEEAFC', grip: '#C7BFF2' },
        line: { DEFAULT: '#E6E6EC', dashed: '#D8D8E2' },
        ink: { DEFAULT: '#1B1B22', muted: '#8D8D97', faint: '#B7B7C1' },
        warn: '#F5A623',
        success: '#2FAE66',
        canvas: { DEFAULT: '#F4F4F7', track: '#EDEDF2' },
      },
    },
  },
  plugins: [],
}
