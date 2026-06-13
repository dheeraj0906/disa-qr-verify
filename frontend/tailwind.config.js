/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'stretch-green':  '#16a34a',
        'stretch-yellow': '#ca8a04',
        'stretch-red':    '#dc2626',
        'stretch-orange': '#ea580c',
      },
    },
  },
  plugins: [],
};
