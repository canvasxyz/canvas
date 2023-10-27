<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  tag?: string
  size?: 'medium' | 'big'
  theme?: 'brand' | 'alt' | 'sponsor'
  text: string
  href?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  theme: 'brand'
})

const isExternal = computed(
  () => props.href && /^http?:/.test(props.href)
)

const component = computed(() => {
  return props.tag || props.href ? 'a' : 'button'
})
</script>

<template>
  <component
    :is="component"
    class="action HeroAction"
    :class="[size, theme]"
    :href="href"
    :target="isExternal ? '_blank' : undefined"
    :rel="isExternal ? 'noreferrer' : undefined"
  >
    {{ text }}
  </component>
</template>

<style scoped>
.HeroAction {
  display: inline-block;
  border: 1px solid transparent;
  text-align: center;
  font-weight: 600;
  white-space: nowrap;
  transition: color 0.25s, border-color 0.25s, background-color 0.25s;
  margin: 0 6px;
}

.HeroAction:active {
  transition: color 0.1s, border-color 0.1s, background-color 0.1s;
}

.HeroAction.medium {
  border-radius: 20px;
  padding: 0 20px;
  line-height: 38px;
  font-size: 16px;
}

.HeroAction.big {
  border-radius: 24px;
  padding: 0 24px;
  line-height: 46px;
  font-size: 18px;
}

.HeroAction.brand {
  border-color: var(--vp-button-brand-border);
  color: var(--vp-button-brand-text);
  background-color: var(--vp-button-brand-bg);
}

.HeroAction.brand:hover {
  border-color: var(--vp-button-brand-hover-border);
  color: var(--vp-button-brand-hover-text);
  background-color: var(--vp-button-brand-hover-bg);
}

.HeroAction.brand:active {
  border-color: var(--vp-button-brand-active-border);
  color: var(--vp-button-brand-active-text);
  background-color: var(--vp-button-brand-active-bg);
}

.HeroAction.alt {
  border-color: var(--vp-button-alt-border);
  color: var(--vp-button-alt-text);
  background-color: var(--vp-button-alt-bg);
}

.HeroAction.alt:hover {
  border-color: var(--vp-button-alt-hover-border);
  color: var(--vp-button-alt-hover-text);
  background-color: var(--vp-button-alt-hover-bg);
}

.HeroAction.alt:active {
  border-color: var(--vp-button-alt-active-border);
  color: var(--vp-button-alt-active-text);
  background-color: var(--vp-button-alt-active-bg);
}

.HeroAction.sponsor {
  border-color: var(--vp-button-sponsor-border);
  color: var(--vp-button-sponsor-text);
  background-color: var(--vp-button-sponsor-bg);
}

.HeroAction.sponsor:hover {
  border-color: var(--vp-button-sponsor-hover-border);
  color: var(--vp-button-sponsor-hover-text);
  background-color: var(--vp-button-sponsor-hover-bg);
}

.HeroAction.sponsor:active {
  border-color: var(--vp-button-sponsor-active-border);
  color: var(--vp-button-sponsor-active-text);
  background-color: var(--vp-button-sponsor-active-bg);
}
</style>