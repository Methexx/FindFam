import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Brand violet system — additive, does not replace the shadcn tokens
        // above. Opacity modifiers (bg-brand/20) work here since these are
        // hsl(var(...)) like the rest of the palette.
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          strong: 'hsl(var(--brand-strong))',
          soft: 'hsl(var(--brand-soft))',
        },
        // Glass tokens are raw rgba() strings with their own baked-in alpha,
        // NOT hsl(var(...)) — opacity modifiers (bg-glass/50) are a no-op here.
        glass: {
          DEFAULT: 'var(--glass-bg)',
          border: 'var(--glass-border)',
          hover: 'var(--glass-bg-hover)',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px -8px hsl(var(--brand) / 0.35)',
      },
      keyframes: {
        // Radix measures the panel and exposes its height as a custom
        // property; without these the accordion snaps open, since there is
        // no CSS transition between `auto` and `0`.
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // Skeleton sweep. Travels a fixed distance rather than a percentage
        // so the speed reads the same on a one-line row and a full map plate.
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        // Live-marker halo. Used ONLY on non-stale positions — see
        // components/map/circle-map.tsx; the animation is a second channel
        // for the freshness rule, not decoration.
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.5' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.8s infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
