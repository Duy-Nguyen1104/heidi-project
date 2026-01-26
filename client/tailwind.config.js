/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sunlight: {
          DEFAULT: "#FBF582",
          50: "#FEFEF5",
          100: "#FDFCE8",
          200: "#FCF9C0",
          300: "#FBF582",
          400: "#F9EF4A",
          500: "#F7E812",
        },
        charcoal: {
          DEFAULT: "#111827",
          light: "#1F2937",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "SF Pro Display",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
      },
      letterSpacing: {
        tighter: "-0.02em",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 4px 16px -4px rgba(0, 0, 0, 0.1)",
        card: "0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  plugins: [],
};
