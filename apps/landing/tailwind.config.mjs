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
          bg: 'rgb(var(--landing-background-rgb) / <alpha-value>)',
          surface: 'rgb(var(--landing-surface-rgb) / <alpha-value>)',
          'surface-container': 'rgb(var(--landing-surface-container-rgb) / <alpha-value>)',
          'surface-container-high':
            'rgb(var(--landing-surface-container-high-rgb) / <alpha-value>)',
          fg: 'rgb(var(--landing-on-surface-rgb) / <alpha-value>)',
          'fg-muted': 'rgb(var(--landing-on-surface-muted-rgb) / <alpha-value>)',
          'fg-body': 'rgb(var(--landing-on-surface-body-rgb) / <alpha-value>)',
          primary: 'rgb(var(--landing-primary-rgb) / <alpha-value>)',
          'on-primary': 'rgb(var(--landing-on-primary-rgb) / <alpha-value>)',
          'primary-container': 'rgb(var(--landing-primary-container-rgb) / <alpha-value>)',
          'on-primary-container': 'rgb(var(--landing-on-primary-container-rgb) / <alpha-value>)',
          'primary-hover': 'rgb(var(--landing-primary-hover-rgb) / <alpha-value>)',
          tertiary: 'rgb(var(--landing-tertiary-rgb) / <alpha-value>)',
          'on-tertiary': 'rgb(var(--landing-on-tertiary-rgb) / <alpha-value>)',
          'tertiary-container': 'rgb(var(--landing-tertiary-container-rgb) / <alpha-value>)',
          'on-tertiary-container': 'rgb(var(--landing-on-tertiary-container-rgb) / <alpha-value>)',
          outline: 'rgb(var(--landing-outline-rgb) / <alpha-value>)',
          'outline-variant': 'rgb(var(--landing-outline-variant-rgb) / <alpha-value>)',
          focus: 'rgb(var(--landing-focus-rgb) / <alpha-value>)',
          error: 'rgb(var(--landing-error-rgb) / <alpha-value>)',
          'on-error': 'rgb(var(--landing-on-error-rgb) / <alpha-value>)',
          'status-amber': 'rgb(var(--landing-status-amber-fg-rgb) / <alpha-value>)',
          // Composed var keeps dark translucent fills (channel alpha baked in CSS).
          'status-amber-bg': 'var(--landing-status-amber-bg)',
          'status-emerald': 'rgb(var(--landing-status-emerald-fg-rgb) / <alpha-value>)',
          'status-emerald-bg': 'var(--landing-status-emerald-bg)',
          'status-rose': 'rgb(var(--landing-status-rose-fg-rgb) / <alpha-value>)',
          'status-rose-bg': 'var(--landing-status-rose-bg)',
          'status-violet': 'rgb(var(--landing-status-violet-fg-rgb) / <alpha-value>)',
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
