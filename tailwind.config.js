/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#090A0F',
        surface: '#11121A',
        primary: '#6558F5',
        secondary: '#23B5D3',
        success: '#2DBA7F',
        warning: '#F7B500',
        error: '#F3696E',
      },
      fontFamily: {
        display: ['System'],
      },
    },
  },
  plugins: [],
};
