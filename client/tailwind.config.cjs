/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#7e22ce',
          light:   '#a855f7',
          dark:    '#581c87',
        },
        primary: {
          50:  '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
