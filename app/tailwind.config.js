/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#00F2FE", // Cyan
        secondary: "#1E3A5F", // Navy
        accent: "#F97316", // Naranja
        glassBg: "rgba(15, 23, 42, 0.7)",
        glassBorder: "rgba(255, 255, 255, 0.1)",
      },
    },
  },
  plugins: [],
}
