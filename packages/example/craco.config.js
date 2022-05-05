const webpack = require("webpack")
const CopyWebpackPlugin = require("copy-webpack-plugin")
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = {
	webpack: {
		configure: {
			ignoreWarnings: [
				{
					module: /randombytes\.js$/,
					message: /require function is used in a way in which/,
				},
				{
					module: /better-sqlite3\/lib\/database\.js$/,
					message: /the request of a dependency is an expression/,
				},
			],
			resolve: {
				fallback: {
					"better-sqlite3": false,
					fs: require.resolve("memfs"),
				},
			},
			plugins: [
				new NodePolyfillPlugin({
					excludeAliases: ["console"],
				}),
				new CopyWebpackPlugin({
					patterns: [
						process.env.NODE_ENV === "production"
							? { from: "./node_modules/sql.js/dist/sql-wasm.wasm", to: "./" }
							: {
									from: "./node_modules/sql.js/dist/sql-wasm.wasm",
									to: "./public",
							  },
					],
				}),
			],
		},
	},
}
