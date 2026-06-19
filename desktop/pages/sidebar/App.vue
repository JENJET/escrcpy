<template>
  <el-config-provider :locale="locale">
    <div class="absolute inset-0 sidebar-wrap" style="width: 100%; height: 100%">
      <ControlBar :device="currentDevice" floating vertical />
    </div>
  </el-config-provider>
</template>

<script setup>
import ControlBar from '$/components/control-bar/index.vue'

const { currentDevice, locale } = useWindowStateSync({ deviceSync: true })
</script>

<style lang="postcss">
html,
body {
  background-color: transparent;
  overflow: hidden;
  margin: 0;
  padding: 0;
  height: 100%;
}

.el-button.el-button-nav-vert {
  display: none !important;
}

.sidebar-wrap .bg-primary-100 {
  border-radius: 8px;
}
</style>
