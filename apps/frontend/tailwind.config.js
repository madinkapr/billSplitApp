/** @type {import('tailwindcss').Config} */

// Design tokens live as CSS variables in src/index.css (light + dark).
// color-mix keeps Tailwind opacity modifiers (e.g. `border-accent/40`) working with them.
const token = (name) => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  future: {
    // `hover:` only applies on devices that can actually hover.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: { DEFAULT: token('surface'), 2: token('surface-2') },
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
          // Legacy, remove once nothing uses it.
          dashed: '#D8D8E2',
        },
        ink: {
          DEFAULT: token('ink'),
          2: token('ink-2'),
          // Legacy, remove once nothing uses them.
          muted: '#8D8D97',
          faint: '#B7B7C1',
        },
        accent: {
          DEFAULT: token('accent'),
          ink: token('accent-ink'),
          tint: token('accent-tint'),
          line: token('accent-line'),
          // Legacy, remove once nothing uses it.
          grip: '#9DC2ED',
        },
        'on-accent': token('on-accent'),
        link: token('link'),
        ok: { DEFAULT: token('ok'), fill: token('ok-fill'), tint: token('ok-tint') },
        warn: { DEFAULT: token('warn'), tint: token('warn-tint') },
        'muted-pill': token('muted-pill'),
        a1: { DEFAULT: token('a1-bg'), fg: token('a1-fg') },
        a2: { DEFAULT: token('a2-bg'), fg: token('a2-fg') },
        a3: { DEFAULT: token('a3-bg'), fg: token('a3-fg') },
        a4: { DEFAULT: token('a4-bg'), fg: token('a4-fg') },
        a5: { DEFAULT: token('a5-bg'), fg: token('a5-fg') },

        // Legacy palettes, removed once the old screens are rebuilt on the tokens above.
        indigo: {
          50: '#eef4fc',
          100: '#d6e6fa',
          500: '#2b7fde',
          600: '#1669d3',
          700: '#114f9e',
        },
        success: '#2FAE66',
        canvas: { DEFAULT: '#F4F4F7', track: '#EDEDF2' },
        desktop: {
          sidebar: '#1c1533',
          primary: '#1669d3',
          gradFrom: '#3e8ee8',
          gradTo: '#114f9e',
          content: '#f6f5fb',
          card: '#ffffff',
          cardBorder: '#e7e4f3',
          divider: '#f1effa',
          text: '#181225',
          textSecondary: '#4d4761',
          textMuted: '#726d85',
          textMuted2: '#8b85a0',
          textMuted3: '#9891ac',
          placeholder: '#b3aec3',
          tileHome: '#dcebfb',
          tileQuick: '#dce9fa',
          tileAccent: '#e7f0fc',
          successText: '#1a8f5c',
          successText2: '#1fa971',
          successBg: '#e9f7ef',
          chipBg: '#e9f1fc',
        },
      },
      fontFamily: {
        sans: ['Onest', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        ctl: '12px',
      },
      boxShadow: {
        fab: 'var(--shadow-fab)',
      },
    },
  },
  plugins: [],
}
