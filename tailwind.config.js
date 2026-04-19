/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Tight', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      colors: {
        // Token-backed semantic colors (populated via CSS vars in index.css).
        // Use these in new code; keep gray-* etc. for any existing references.
        canvas:  'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        raised:  'var(--bg-raised)',
        card:    'var(--card-bg)',
        rule:    'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        'rule-faint':  'var(--rule-faint)',
        fg:       'var(--fg)',
        'fg-quiet': 'var(--fg-quiet)',
        'fg-faint': 'var(--fg-faint)',
        accent:   'var(--accent)',
      },
    },
  },
  plugins: [],
}
