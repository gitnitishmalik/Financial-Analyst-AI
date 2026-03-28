/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        display: ["'Syne'", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          900: "#14532d",
        },
        surface: {
          900: "#0a0f0d",
          800: "#0f1812",
          700: "#162118",
          600: "#1e2e22",
          500: "#263a2a",
          400: "#344d38",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        pulse2: "pulse2 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        pulse2: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.5 } },
      },
    },
  },
  plugins: [],
};
