<script>
  import { ref } from 'vue'
  import GameDemo from "./GameDemo.jsx"

  // import { applyPureReactInVue } from "veaury"
  import * as pkg from "veaury"
  const isBrowser = new Function("try {return this===window;}catch(e){ return false;}")
  const { applyPureReactInVue } = isBrowser() ? pkg : pkg.default

  export default {
    components: {
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
.democell-internal {
  min-height: 324px;
  position: relative;
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
}
.DemoCell .peers, .DemoCell .peer-details {
  font-size: 14px;
  opacity: 0.6;
}
.DemoCell .peer-details {
  margin-top: 20px;
  line-height: 1.25;
  word-break: break-word;
}
@media (min-width: 960px) {
  .DemoCell.GameDemo .peers {
    bottom: 13px;
    right: 20px;
  }
  .DemoCell .peer-details {
    max-width: 300px;
    word-break: break-word;
    background-color: var(--vp-c-bg-soft);
  }
}
.DemoCell .caption .peers {
  right: 0;
  bottom: 1px;
}
.DemoCell .text-pop {
  animation: text-pop 0.25s ease-in-out;
}
@keyframes text-pop {
  50%  {
    transform: scale(1.25);
  }
}
</style>