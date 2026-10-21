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
        },
        ink: {
          DEFAULT: token('ink'),
          2: token('ink-2'),
        },
        accent: {
          DEFAULT: token('accent'),
          ink: token('accent-ink'),
          tint: token('accent-tint'),
          line: token('accent-line'),
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
