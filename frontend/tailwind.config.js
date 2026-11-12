/** @type {import('tailwindcss').Config} */
// Design-System: CrowdInsights / Heizcockpit-Look, Markenfarbe Blau statt Grün.
// Die bestehenden Klassen (emerald-*, gray-*, slate-*, rounded-*) werden hier
// zentral auf die Tokens umgebogen, damit die Views unverändert bleiben.
const blue = {
  50: '#EEF4FE',
  100: '#DCE8FC',
  200: '#B9D1F9',
  300: '#8DB5F4',
  400: '#5B94EE',
  500: '#3A82EA',
  600: '#2F6FD6',
  700: '#2459B0',
  800: '#1D4789',
  900: '#163563',
  950: '#0F2444',
}
const ink = {
  50: '#FBFBFB',
  100: '#F0F0F0',
  200: '#E4E4E7',
  300: '#C8C8D0',
  400: '#9292A0',
  500: '#767684',
  600: '#5F5F6D',
  700: '#3B3B3B',
  800: '#26262C',
  900: '#201F24',
  950: '#18171B',
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    borderRadius: {
      none: '0',
      sm: '2px',
      DEFAULT: '2px',
      md: '2px',
      lg: '2px',
      xl: '2px',
      '2xl': '2px',
      '3xl': '2px',
      full: '9999px',
    },
    extend: {
      colors: {
        brand: blue,
        primary: blue,
        emerald: blue,
        green: blue,
        teal: blue,
        gray: ink,
        slate: ink,
        ink: ink,
        danger: { DEFAULT: '#E21227', bg: '#FFE3E3' },
        warning: { DEFAULT: '#A36200', bg: '#FFEF89' },
        success: { DEFAULT: '#267203', bg: '#E6FFBF' },
        info: { DEFAULT: '#007BA8', bg: '#D9F2FF' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        sm: '0 1px 2px rgb(32 31 36 / .06), 0 1px 3px rgb(32 31 36 / .06)',
        DEFAULT: '0 1px 2px rgb(32 31 36 / .06), 0 1px 3px rgb(32 31 36 / .06)',
        md: '0 2px 4px rgb(32 31 36 / .08), 0 4px 12px rgb(32 31 36 / .08)',
        lg: '0 8px 24px rgb(32 31 36 / .12)',
        xl: '0 8px 24px rgb(32 31 36 / .12)',
        '2xl': '0 8px 24px rgb(32 31 36 / .12)',
      },
      letterSpacing: {
        caps: '0.1em',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        DEFAULT: '140ms',
      },
    },
  },
  plugins: [],
}
