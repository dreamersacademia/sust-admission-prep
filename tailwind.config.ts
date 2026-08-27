import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12261E',        // deep pine, near-black — primary text
        parchment: '#F4EFE3',  // warm exam-paper background
        signal: '#1F6F5C',     // muted emerald — correct/progress accent
        alert: '#B4432E',      // brick red — timer/danger accent
        line: '#D8CFB8',       // hairline rules on parchment
      },
      fontFamily: {
        display: ['"Tiro Bangla"', '"Noto Serif Bengali"', 'serif'],
        body: ['"Noto Sans Bengali"', '"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
