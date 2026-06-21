<template>
  <el-config-provider :locale="locale">
    <div class="absolute inset-0 sidebar-wrap" style="width: 100%; height: 100%">
      <ControlBar
        :device="currentDevice" floating :vertical="isPortrait" sidebar :button-height="sidebarBtnHeight"
        :button-width="sidebarBtnWidth" :nav-btn-size="sidebarNavBtnSize"
      />
    </div>
  </el-config-provider>
</template>

<script setup>
import ControlBar from '$/components/control-bar/index.vue'
import { sidebarBtnHeight, sidebarBtnWidth, sidebarNavBtnSize } from '$sidebar/configs/index.js'

const { currentDevice, locale } = useWindowStateSync({ deviceSync: true })
const isPortrait = ref(true)

onMounted(() => {
  window.$preload.ipcRenderer?.on?.('sidebar-orientation', (event, val) => {
    isPortrait.value = val === 0
  })
})

onUnmounted(() => {
  window.$preload.ipcRenderer?.off?.('sidebar-orientation')
})
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
