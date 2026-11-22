/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf7",
          100: "#d6f5ec",
          500: "#14a38b",
          600: "#0e8571",
          700: "#0d6a5b",
        },
      },
    },
  },
  plugins: [],
};
