// https://vitepress.dev/guide/custom-theme
import { h } from "vue"
import type { Theme } from "vitepress"
import DefaultTheme from "vitepress/theme"
import FloatingVue from "floating-vue"
import CodeGroupOpener from "../components/CodeGroupOpener.vue"
import BlogRedirect from "../components/BlogRedirect.vue"
import HeroRow from "../components/HeroRow.vue"
import HeroAction from "../components/HeroAction.vue"
import FeatureCard from "../components/FeatureCard.vue"
import FeatureRow from "../components/FeatureRow.vue"
import TextItem from "../components/TextItem.vue"
import TextRow from "../components/TextRow.vue"
import HomepageFooter from "../components/HomepageFooter.vue"
import FeatureTags from "../components/FeatureTags.vue"
import EmailForm from "../components/EmailForm.vue"
import Version from "../components/Version.vue"
import Iframe from "../components/Iframe.vue"
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
		app.use(FloatingVue)
		app.component("BlogRedirect", BlogRedirect)
		app.component("CodeGroupOpener", CodeGroupOpener)
		app.component("HeroRow", HeroRow)
		app.component("HeroAction", HeroAction)
		app.component("FeatureCard", FeatureCard)
		app.component("FeatureRow", FeatureRow)
		app.component("TextItem", TextItem)
		app.component("TextRow", TextRow)
		app.component("HomepageFooter", HomepageFooter)
		app.component("FeatureTags", FeatureTags)
		app.component("EmailForm", EmailForm)
		app.component("Version", Version)
		app.component("Iframe", Iframe)
	},
} satisfies Theme
