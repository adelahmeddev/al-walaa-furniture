/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#102B4D',
          50: '#F1F5F9',
          100: '#E2E8F0',
          600: '#102B4D',
          700: '#0D2440',
          800: '#0A1F38',
          900: '#081B33',
          dark: '#051120',
          light: '#1B3F6B',
        },
        accent: {
          DEFAULT: '#8F5E06',
          50: '#FDF8EB',
          100: '#FBF0D1',
          200: '#EED484',
          300: '#F2C96B',
          400: '#D49A24',
          500: '#C48A18',
          600: '#8F5E06',
          700: '#7A4F04',
        },
        surface: {
          warm: '#FBF9F5',
          muted: '#F3EFE6',
        },
        whatsapp: {
          DEFAULT: '#15803D',
          hover: '#166534',
          dark: '#14532D',
        },
      },
      fontFamily: {
        arabic: ['IBM Plex Sans Arabic', 'Cairo', 'system-ui', 'sans-serif'],
        arabicDisplay: ['Cairo', 'IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
        english: ['Inter', 'system-ui', 'sans-serif'],
        englishDisplay: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card-hover': '0 14px 30px -12px rgba(8, 27, 51, 0.14)',
        'elevated': '0 20px 44px -16px rgba(8, 27, 51, 0.24)',
      },
    },
  },
  plugins: [],
};
