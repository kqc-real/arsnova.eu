/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        landing: {
          bg: 'var(--landing-background)',
          surface: 'var(--landing-surface)',
          'surface-container': 'var(--landing-surface-container)',
          'surface-container-high': 'var(--landing-surface-container-high)',
          fg: 'var(--landing-on-surface)',
          'fg-muted': 'var(--landing-on-surface-muted)',
          'fg-body': 'var(--landing-on-surface-body)',
          primary: 'var(--landing-primary)',
          'on-primary': 'var(--landing-on-primary)',
          'primary-container': 'var(--landing-primary-container)',
          'on-primary-container': 'var(--landing-on-primary-container)',
          'primary-hover': 'var(--landing-primary-hover)',
          tertiary: 'var(--landing-tertiary)',
          'on-tertiary': 'var(--landing-on-tertiary)',
          'tertiary-container': 'var(--landing-tertiary-container)',
          'on-tertiary-container': 'var(--landing-on-tertiary-container)',
          outline: 'var(--landing-outline)',
          'outline-variant': 'var(--landing-outline-variant)',
          focus: 'var(--landing-focus)',
          error: 'var(--landing-error)',
          'on-error': 'var(--landing-on-error)',
          'status-amber': 'var(--landing-status-amber-fg)',
          'status-amber-bg': 'var(--landing-status-amber-bg)',
          'status-emerald': 'var(--landing-status-emerald-fg)',
          'status-emerald-bg': 'var(--landing-status-emerald-bg)',
          'status-rose': 'var(--landing-status-rose-fg)',
          'status-rose-bg': 'var(--landing-status-rose-bg)',
          'status-violet': 'var(--landing-status-violet-fg)',
          'status-violet-bg': 'var(--landing-status-violet-bg)',
        },
      },
      borderRadius: {
        'landing-button': 'var(--landing-radius-button)',
        'landing-card': 'var(--landing-radius-card)',
        'landing-panel': 'var(--landing-radius-panel)',
      },
      boxShadow: {
        'landing-1': 'var(--landing-elevation-1)',
        'landing-2': 'var(--landing-elevation-2)',
      },
      transitionDuration: {
        'landing-fast': 'var(--landing-motion-fast)',
        'landing-standard': 'var(--landing-motion-standard)',
      },
    },
  },
  plugins: [],
};
