// https://vitepress.dev/guide/custom-theme
import { h } from "vue"
import type { Theme } from "vitepress"
import DefaultTheme from "vitepress/theme"
import HeroRow from "../components/HeroRow.vue"
import HeroAction from "../components/HeroAction.vue"
import HomepageFooter from "../components/HomepageFooter.vue"
import { MotionPlugin } from "@vueuse/motion"
import "./style.css"

export default {
	extends: DefaultTheme,
	Layout: () => {
		return h(DefaultTheme.Layout, null, {
			// https://vitepress.dev/guide/extending-default-theme#layout-slots
		})
	},
	enhanceApp({ app, router, siteData }) {
		app.use(MotionPlugin)
		app.component("HeroRow", HeroRow)
		app.component("HeroAction", HeroAction)
		app.component("HomepageFooter", HomepageFooter)
	},
} satisfies Theme
