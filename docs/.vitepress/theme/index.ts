// https://vitepress.dev/guide/custom-theme
import { h } from "vue"
import type { Theme } from "vitepress"
import DefaultTheme from "vitepress/theme"
import HeroRow from "../components/HeroRow.vue"
import HeroAction from "../components/HeroAction.vue"
import DemoToggle from "../components/DemoToggle.vue"
import DemoCell from "../components/DemoCell.vue"
import FeatureCard from "../components/FeatureCard.vue"
import FeatureRow from "../components/FeatureRow.vue"
import TextItem from "../components/TextItem.vue"
import TextRow from "../components/TextRow.vue"
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
		app.component("DemoToggle", DemoToggle)
		app.component("DemoCell", DemoCell)
		app.component("FeatureCard", FeatureCard)
		app.component("FeatureRow", FeatureRow)
		app.component("TextItem", TextItem)
		app.component("TextRow", TextRow)
		app.component("HomepageFooter", HomepageFooter)
	},
} satisfies Theme
