const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const Dotenv = require("dotenv-webpack");

module.exports = {
  mode: "development",
  stats: "minimal",
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
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
      {
        test: /\.svg$/,
        use: ["@svgr/webpack"],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],

    // TODO: remove this when dependencies update
    // @metamask/eth-sig-util@5.1.0 -> @ethereumjs/util@8.0.6 -> micro-ftch@0.3.1
    fallback: {
      url: false,
      zlib: false,
      http: false,
      https: false,
      stream: false,
      process: false,
      buffer: require.resolve("buffer"),
    },
  },
  experiments: {
    outputModule: true,
    topLevelAwait: true,
  },
  plugins: [
    new Dotenv(),
    new CopyWebpackPlugin({ patterns: [{ from: "public" }] }),
    new webpack.ProvidePlugin({ Buffer: ["buffer", "Buffer"] }),
    new webpack.DefinePlugin({
      "process.env.HOST": JSON.stringify(
        process.env.HOST ?? "http://localhost:8000",
      ),
    }),
  ],
  devServer: {
    static: [path.join(__dirname, "public")],
    hot: true,
  },
};
