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
    return {
      preferenceStore,
      deviceStore,
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

        window.$preload.ipcRenderer.send('sidebar-open', { mirrorId, deviceId: row.id, mirrorTitle })

        await sleep(500)

        this.loading = false

        openFloatControl(toRaw(row))

        await mirroring

        window.$preload.ipcRenderer.send('sidebar-close', mirrorId)
      }
      catch (error) {
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
