/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        "steel-primary": "#0F7EBB",
        "steel-secondary": "#334155",
        "steel-accent": "#7DD3FC",
        "steel-bg": "#1E293B",
      },
    },
  },
  plugins: [],
};
