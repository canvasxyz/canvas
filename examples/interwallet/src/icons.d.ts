declare module "*.svg" {
	import React = require("react")

	const content: React.FunctionComponent<React.SVGProps<SVGSVGElement>>
	export default content
}
