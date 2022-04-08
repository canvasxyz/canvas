import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";

const config = {
	webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
		config.plugins.push(new ForkTsCheckerWebpackPlugin())
		config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^electron$/ }));

		// return the modified config
		return config
	},
}

export default config
