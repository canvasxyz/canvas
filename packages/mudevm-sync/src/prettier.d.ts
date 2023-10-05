declare module "prettier" {
	export function format(source: string, options?: Options): Promise<string>

	export interface ResolveConfigOptions {
		/**
		 * If set to `false`, all caching will be bypassed.
		 */
		useCache?: boolean | undefined
		/**
		 * Pass directly the path of the config file if you don't wish to search for it.
		 */
		config?: string | undefined
		/**
		 * If set to `true` and an `.editorconfig` file is in your project,
		 * Prettier will parse it and convert its properties to the corresponding prettier configuration.
		 * This configuration will be overridden by `.prettierrc`, etc. Currently,
		 * the following EditorConfig properties are supported:
		 * - indent_style
		 * - indent_size/tab_width
		 * - max_line_length
		 */
		editorconfig?: boolean | undefined
	}

	export function resolveConfig(filePath: string, options?: ResolveConfigOptions): Promise<Options | null>
}
