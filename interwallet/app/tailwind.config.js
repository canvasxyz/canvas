// import path from "node:path";
// import { createRequire } from "node:module";

// const libp2pStatusComponents = path.dirname(
//   createRequire(import.meta.url).resolve("@canvas-js/libp2p-status-components"),
// );

export default {
  content: [
    "./src/**/*.{html,js,tsx}",
    "../libp2p-status-components/**/*.js",
  ],
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
