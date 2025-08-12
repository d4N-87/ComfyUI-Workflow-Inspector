/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'background': '#030b17',
        'surface': 'rgb(19 28 48 / 0.7)',
        'border': 'rgb(55 65 81 / 0.5)',
        'primary-text': '#E5E7EB',
        'secondary-text': '#9CA3AF',
        'primary-accent': '#22d3ee', // Cyan
        'secondary-accent': '#fbbf24', // Amber
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // For body text
        display: ['Unica One', 'cursive'], // For headings and titles
      },
      keyframes: {
        'subtle-float': {
          '0%, 100%': { transform: 'translateY(0) rotate(0)' },
          '25%': { transform: 'translateY(-4px) rotate(1deg)' },
          '75%': { transform: 'translateY(4px) rotate(-1deg)' },
        },
        stripes: {
          '0%': { backgroundPosition: '1rem 0' },
          '100%': { backgroundPosition: '0 0' }
        }
      },
      animation: {
        'subtle-float': 'subtle-float 10s ease-in-out infinite',
        stripes: 'stripes 1s linear infinite'
      },
    },
  },
  plugins: [],
}