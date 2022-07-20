const path = require("path")

module.exports = {
	mode: "development",
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
	devServer: {
		static: [path.join(__dirname, "dist"), path.join(__dirname, "public")],
		hot: true,
	},
}
