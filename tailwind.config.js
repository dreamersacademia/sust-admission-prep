/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep academic indigo — not the default AI-generated cream/terracotta or pure black.
        ink: {
          50: "#f1f3fb",
          100: "#dfe3f5",
          400: "#5b67a8",
          600: "#2f3878",
          800: "#1a2050",
          900: "#101636",
          950: "#0a0e24",
        },
        // Warm marigold — Bangladeshi exam-hall energy, used sparingly as the signature accent.
        marigold: {
          400: "#f6b93b",
          500: "#eda315",
          600: "#c9820a",
        },
        // Result feedback colors
        success: "#2fae6f",
        danger: "#e0524a",
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-hind)", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 22, 54, 0.06), 0 8px 24px -8px rgba(16, 22, 54, 0.12)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
