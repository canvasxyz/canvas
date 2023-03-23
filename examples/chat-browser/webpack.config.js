const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development",
  stats: "minimal",
  target: "web",
  devtool: "inline-source-map",
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
    module: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /spec\.canvas\.js$/,
        type: "asset/resource",
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".mjs"],
    fallback: {
      fs: false,
      path: false,
      crypto: false,
    },
  },
  optimization: {
    providedExports: true,
    sideEffects: true,
  },
  experiments: {
    outputModule: true,
    topLevelAwait: true,
  },
  plugins: [
    new CopyWebpackPlugin({ patterns: [{ from: "public" }] }),
  ],
  devServer: {
    static: [path.join(__dirname, "public")],
    hot: true,
  },
};
