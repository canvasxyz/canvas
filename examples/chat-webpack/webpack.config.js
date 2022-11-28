const path = require("path")
const webpack = require("webpack")
const CopyWebpackPlugin = require("copy-webpack-plugin")
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

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
				use: ["style-loader", "css-loader"],
			},
		],
	},
	resolve: {
		extensions: [".tsx", ".ts", ".js"],
	},
	experiments: {
		outputModule: true,
	},
	plugins: [
		new NodePolyfillPlugin(),
		new CopyWebpackPlugin({
			patterns: [{ from: "public" }],
		}),
		new webpack.DefinePlugin({
			"process.env.BUNDLER": JSON.stringify(process.argv[2]),
		}),
	],
	devServer: {
		static: [path.join(__dirname, "dist"), path.join(__dirname, "public")],
		hot: true,
	},
}
