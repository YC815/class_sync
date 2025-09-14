import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  plugins: [
    require('@tailwindcss/typography'),
  ],
} satisfies Config