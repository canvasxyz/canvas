<template>
  <div class="HomepageFooter">
    <img src="./icon_logo.png" width="64">
    &copy; 2023 Canvas Technologies, Inc.
  </div>
</template>

<style>
.HomepageFooter {
  text-align: center;
  margin: 0 auto;
  max-width: 400px;
  margin-top: 60px;
  color: var(--vp-c-text-3);
  font-family: var(--space-font-family);
}

.HomepageFooter img {
  margin: 0 auto;
  margin-bottom: 20px;
}

.dark .HomepageFooter img {
  padding: 64px 64px 0 0;
  background-image: url('./icon_logo_dark.png');
  background-size: cover;
  width:0px;
  height: 0px;
}

.VPHome {
  padding-bottom: 40px !important;
}
</style>