import path, { dirname } from "path"
import { fileURLToPath } from "url"
import webpack from "webpack"

export default {
	mode: "production",
	entry: "./src/bundle.ts",
	module: {
		rules: [
			{
				test: /\.ts?$/,
				use: "ts-loader",
				exclude: /node_modules/,
			},
		],
	},
	output: {
		filename: "bundle-compiled.js",
		path: path.resolve(dirname(fileURLToPath(import.meta.url)), "lib"),
		publicPath: "",
	},
	plugins: [
		new webpack.optimize.LimitChunkCountPlugin({
			maxChunks: 1,
		}),
	],
	stats: {
		warningsFilter: ["WARNING in entrypoint size limit:*", "WARNING in webpack performance recommendations:*"],
	},
}
