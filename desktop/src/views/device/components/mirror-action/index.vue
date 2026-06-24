<template>
  <el-button
    type="primary"
    text
    :disabled="['unauthorized', 'offline'].includes(row.status)"
    :loading="loading"
    :icon="loading ? '' : 'Monitor'"
    :title="loading ? $t('common.starting') : $t('device.mirror.start')"
    @click="handleClick(row)"
  >
  </el-button>
</template>

<script>
import { sleep } from '$/utils'
import { openFloatControl } from '$/utils/device/index.js'
import { controlDefinitions, isControlHidden } from '$/components/control-bar/index.vue'

export default {
  props: {
    row: {
      type: Object,
      default: () => ({}),
    },
    toggleRowExpansion: {
      type: Function,
      default: () => () => false,
    },
  },
  setup() {
    const preferenceStore = usePreferenceStore()
    const deviceStore = useDeviceStore()
    const controlStore = useControlStore()
    return {
      preferenceStore,
      deviceStore,
      controlStore,
    }
  },
  data() {
    return {
      loading: false,
    }
  },
  methods: {
    async handleClick(row = this.row) {
      this.loading = true

      this.toggleRowExpansion(row, true)

      const args = this.preferenceStore.scrcpyParameter(row.id)

      try {
        const mirrorTitle = `${this.deviceStore.getLabel(row, 'mirror')}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const mirrorId = `${row.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

        const mirroring = this.$scrcpy.mirror(row.id, {
          title: mirrorTitle,
          args,
          mirrorId,
          stdout: this.onStdout,
          stderr: this.onStderr,
        })

        // sidebar 下 (floating=true) 根据 hiddenKeys 排除隐藏按钮
        const sidebarProps = { floating: true }
        const sidebarBtnCount = [...new Set(this.controlStore.barLayout)]
          .filter(k => {
            const def = controlDefinitions[k]
            return !def || !isControlHidden(def, sidebarProps)
          }).length || undefined
        window.$preload.ipcRenderer.send('sidebar-open', { mirrorId, deviceId: row.id, mirrorTitle, btnCount: sidebarBtnCount })

        await sleep(500)

        this.loading = false

        openFloatControl(toRaw(row))

        await mirroring

        window.$preload.ipcRenderer.send('sidebar-close', mirrorId)
      }
      catch (error) {
        window.$preload.ipcRenderer.send('sidebar-close', mirrorId)
        console.error('mirror.args', args)
        console.error('mirror.error', error)

        if (error.message) {
          this.$message.warning(error.message)
        }
      }
    },

    onStdout() {},
    onStderr() {},
  },
}
</script>

<style></style>
