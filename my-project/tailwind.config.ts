import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        primary: '#2563eb',
        secondary: '#7c3aed',
        accent: '#10b981',
        background: '#0f172a',
        text: '#FFFFFF',
        error: '#ef4444',
        success: '#10b981',
      },
    },
  },
  plugins: [],
}
export default config
