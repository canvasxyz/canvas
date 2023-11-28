<script>
  import { ref } from 'vue'
  import MessagingDemo from "./MessagingDemo.jsx"
  import GameDemo from "./GameDemo.jsx"

  // import { applyPureReactInVue } from "veaury"
  import * as pkg from "veaury"
  const isBrowser = new Function("try {return this===window;}catch(e){ return false;}")
  const { applyPureReactInVue } = isBrowser() ? pkg : pkg.default

  export default {
    components: {
      MessagingDemo: applyPureReactInVue(MessagingDemo),
      GameDemo: applyPureReactInVue(GameDemo)
    }
  }
</script>

<template>
  <div class="DemoCell GameDemo">
		<client-only>
      <GameDemo />
		</client-only>
  </div>
  <div class="DemoCell MessagingDemo">
		<client-only>
      <MessagingDemo />
		</client-only>
  </div>
</template>

<style>
.DemoCell {
  display: block;
  position: relative;
  min-height: 220px;
  margin: 0 20px 20px;
  max-width: 640px;
  padding: 18px 20px;
  border: 1px solid var(--vp-c-bg-soft);
  border-radius: 12px;
  height: 100%;
  background-color: var(--vp-c-bg-soft);
}
@media (min-width: 600px) {
  .DemoCell {
    margin: 0 auto 20px;
  }
}
@media (min-width: 960px) {
  .DemoCell {
    display: block;
    position: absolute !important;
    left: calc(50vw + 210px / 2 + 30px);
    height: 348px;
    width: 320px;
    z-index: 10;
    box-shadow: 1px 1px 6px rgba(0,0,0,0.2);
  }
}
.DemoCell.MessagingDemo input[type="text"] {
  background: var(--vp-c-bg);
  padding: 6px 12px;
  border-radius: 6px;
  font-family: var(--vp-font-family-base);
  font-size: 15px;
  width: calc(100% - 40px);
  position: absolute;
  bottom: 12px;
}
.DemoCell input[type="submit"] {
  display: inline-block;
  background: var(--vp-c-brand-3);
  margin-top: 6px;
  padding: 1px 8px;
  margin-right: -4px;
  border-radius: 6px;
  color: #f7f3eb;
  font-family: var(--vp-font-family-base);
  font-size: 14px;
  cursor: pointer;
}
.DemoCell input[type="submit"]:hover {
  transition: background 100ms ease-in-out;
  background: var(--vp-c-brand-2);
}
.DemoCell .caption {
  position: relative;
  color: var(--vp-c-text-1);
  font-size: 14px;
}
.DemoCell .peers {
  position: absolute;
  right: 34px;
  bottom: 18px;
  font-size: 14px;
  opacity: 0.33;
}
@media (min-width: 960px) {
  .DemoCell.GameDemo .peers {
    bottom: 13px;
    right: 20px;
  }
}
.DemoCell .caption .peers {
  right: 0;
  bottom: 1px;
}
</style>