/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          650: '#27272a',
          700: '#27272a', // crisp borders
          750: '#1f1f23',
          800: '#121214', // elevated cards / button hovers
          850: '#0c0c0e', // inset areas / inputs
          900: '#09090b', // main card surface
          950: '#000000', // pure deep obsidian black canvas
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
