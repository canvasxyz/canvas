const path = require("path")
const webpack = require("webpack")
const CopyWebpackPlugin = require("copy-webpack-plugin")

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
		new CopyWebpackPlugin({ patterns: [{ from: "public" }] }),
		new webpack.DefinePlugin({ "process.env.HOST": JSON.stringify(process.env.HOST) }),
	],
	devServer: {
		static: [path.join(__dirname, "public")],
		hot: true,
	},
}
