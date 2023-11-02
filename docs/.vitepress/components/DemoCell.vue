<script>
  import { ref } from 'vue'
  import MessagingDemo from "./MessagingDemo.jsx"
  import GamingDemo from "./GamingDemo.jsx"

  // import { applyPureReactInVue } from "veaury"
  import * as pkg from "veaury"
  const isBrowser = new Function("try {return this===window;}catch(e){ return false;}")
  const { applyPureReactInVue } = isBrowser() ? pkg : pkg.default

  export default {
    components: {
      MessagingDemo: applyPureReactInVue(MessagingDemo),
      GamingDemo: applyPureReactInVue(GamingDemo)
    },
    setup() {
      function onClickForReact() {
        console.log('clicked!')
      }
      return {
        onClickForReact,
      }
    }
  }
</script>

<template>
  <div class="DemoCell MessagingDemo">
    <MessagingDemo @click="onClickForReact"/>
  </div>
  <div class="DemoCell GamingDemo">
    <GamingDemo @click="onClickForReact"/>
  </div>
</template>

<style>
.DemoCell {
  display: block;
  margin: 20px;
  max-width: 560px;
  padding: 18px 20px;
  border: 1px solid var(--vp-c-bg-soft);
  border-radius: 12px;
  height: 100%;
  background-color: var(--vp-c-bg-soft);
}
@media (min-width: 600px) {
  .DemoCell {
    margin: 20px auto;
  }
}
.DemoCell input {
  background: var(--vp-c-bg);
  padding: 6px 12px;
  border-radius: 6px;
  font-family: var(--vp-font-family-base);
  font-size: 15px;
  width: 100%;
}
</style>