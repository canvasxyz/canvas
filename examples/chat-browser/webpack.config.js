import path from "node:path";
import CopyWebpackPlugin from "copy-webpack-plugin";
import webpack from "webpack";

export default {
  mode: "development",
  stats: "minimal",
  target: "web",
  devtool: "inline-source-map",
  entry: "./src/index.tsx",
  output: {
    path: path.resolve("dist"),
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
    new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"] }),
  ],
  devServer: {
    static: [path.resolve("public")],
    hot: true,
  },
};
