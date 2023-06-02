import svgr from "vite-plugin-svgr";
import { config } from "dotenv";
config();

console.log("GOT ENV", process.env.BOOTSTRAP_LIST);

export default {
  plugins: [svgr({})],
  define: {
    "process.env.BOOTSTRAP_LIST": JSON.stringify(process.env.BOOTSTRAP_LIST),
  },
};
