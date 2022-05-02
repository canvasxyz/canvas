const webpack = require("webpack")
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")
const CopyWebpackPlugin = require("copy-webpack-plugin")

const PROD = process.env.NODE_ENV === "production"

module.exports = function override(config) {
  config.resolve.extensions = [".ts", ".js"]
  config.ignoreWarnings = [
    {
      module: /randombytes\.js$/,
      message: /require function is used in a way in which/,
    },
    {
      module: /better-sqlite3\/lib\/database\.js$/,
      message: /the request of a dependency is an expression/,
    },
  ]

  const fallback = config.resolve.fallback || {}
  Object.assign(fallback, {
    "better-sqlite3": false,
    fs: require.resolve("memfs"),
  })

  const add = config.plugins || []
  add.push(
    new CopyWebpackPlugin({
      patterns: [
        PROD
          ? { from: "./node_modules/sql.js/dist/sql-wasm.wasm", to: "./" }
          : {
              from: "./node_modules/sql.js/dist/sql-wasm.wasm",
              to: "./public",
            },
      ],
    })
  )
  add.push(
    new NodePolyfillPlugin({
      excludeAliases: ["console"],
    })
  )
  config.plugins = add

  config.resolve.fallback = fallback
  return config
}
