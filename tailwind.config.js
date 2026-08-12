/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        darkBg: '#0A0D14',
        darkCard: '#1A1F26',
        greenAccent: '#10B981',
        blueAccent: '#3B82F6',
        purpleAccent: '#A855F7',
        pinkAccent: '#E91E63',
        orangeAccent: '#F59E0B',
        textWhite: '#FFFFFF',
        textGray: '#9CA3AF',
      },
    },
  },
  plugins: [],
};
