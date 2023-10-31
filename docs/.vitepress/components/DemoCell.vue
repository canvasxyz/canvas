<script>
  import { ref } from 'vue'
  import MessageSyncDemo from "./MessageSyncDemo.jsx"
  import ModelDBDemo from "./ModelDBDemo.jsx"

  // import { applyPureReactInVue } from "veaury"
  import * as pkg from "veaury"
  const { applyPureReactInVue } = pkg.default

  export default {
    components: {
      MessageSyncDemo: applyPureReactInVue(MessageSyncDemo),
      ModelDBDemo: applyPureReactInVue(ModelDBDemo)
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
  <div class="DemoCell MessageSyncDemo">
    <MessageSyncDemo @click="onClickForReact"/>
  </div>
  <div class="DemoCell ModelDBDemo">
    <ModelDBDemo @click="onClickForReact"/>
  </div>
</template>

<style>
.DemoCell {
  display: block;
  margin: 20px auto;
  max-width: 560px;
  padding: 18px 20px;
  border: 1px solid var(--vp-c-bg-soft);
  border-radius: 12px;
  height: 100%;
  background-color: var(--vp-c-bg-soft);
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