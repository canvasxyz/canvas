/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,tsx}"],
  theme: {
    extend: {
      gridTemplateColumns: {
        "chat-view": "16rem minmax(24rem, auto)",
      },
      gridTemplateRows: {
        "chat-view": "3rem auto",
      },
    },
  },
  plugins: [],
};
