module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary:   '#2E7D32',
        darkgreen: '#1B5E20',
        danger:    '#D32F2F',
        blue:      '#1565C0',
        orange:    '#E65100',
        muted:     '#666666',
      },
    },
  },
  plugins: [],
};
