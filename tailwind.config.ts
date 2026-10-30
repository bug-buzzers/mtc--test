import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Single desaturated terracotta accent (<60% saturation) paired with unified Slate neutrals
        maple: {
          50: '#F9FAFB',
          100: '#F6ECE7',
          200: '#EBD6CC',
          500: '#C25934',
          600: '#A84928',
          700: '#8A3B20',
        },
        forest: {
          50: '#F4F8F6',
          100: '#E3EFE9',
          500: '#2E7D5B',
          600: '#246649',
        },
        admin: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          500: '#C25934',
          600: '#0F172A',
          700: '#1E293B',
        },
      },
      fontFamily: {
        sans: ['Outfit Variable', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        diffusion: '0 20px 40px -15px rgba(15, 23, 42, 0.05)',
        'diffusion-hover': '0 24px 48px -14px rgba(15, 23, 42, 0.08)',
        glass: 'inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 8px 24px -8px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
