<template>
  <div
    class="bg-primary-100 dark:bg-gray-800 group overflow-hidden"
    :class="vertical ? 'flex-col' : 'flex'"
  >
    <el-button
      v-if="!vertical"
      type="primary"
      class="el-button-nav"
      :style="{ ...buttonHeightStyle }"
      title="Prev"
      @click="handlePrev"
    >
      <el-icon><CaretLeft /></el-icon>
    </el-button>

    <Scrollable v-if="!vertical" ref="scrollableRef" class="flex-1 min-w-0" disabled-drag>
      <Swapy
        :key="controlStore.swapyKey"
        :enabled="swapyEnabled"
        class="flex items-center"
        :class="floating ? '!h-full' : ''"
        :config="{ animation: 'dynamic', dragAxis: 'x', autoScrollOnDrag: false }"
        @swap-end="onSwapEnd"
      >
        <ControlBarButton
          v-for="item of controlModel"
          :key="item.id"
          :item="item" :device="device" :floating="floating"
          :button-class="buttonClass" :button-style="buttonStyle"
        />
      </Swapy>
    </Scrollable>
    <div v-else class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full">
      <Swapy
        :key="controlStore.swapyKey"
        :enabled="swapyEnabled"
        class="flex flex-col items-center"
        :config="{ animation: 'dynamic', dragAxis: 'y', autoScrollOnDrag: false }"
        @swap-end="onSwapEnd"
      >
        <ControlBarButton
          v-for="item of controlModel"
          :key="item.id"
          :item="item" :device="device" :floating="floating"
          :button-class="buttonClass" :button-style="buttonStyle" vertical
        />
      </Swapy>
    </div>

    <el-button
      v-if="!vertical"
      type="primary"
      class="el-button-nav"
      :style="{ ...buttonHeightStyle }"
      title="Next"
      @click="handleNext"
    >
      <el-icon><CaretRight /></el-icon>
    </el-button>
  </div>
</template>

<script>
import { controlBarHeight } from '$control/configs/index.js'
import ControlBarButton from './control-bar-button.vue'
import Install from './install/index.vue'
import Launch from './launch/index.vue'
import Explorer from './explorer/index.vue'
import Gnirehtet from './gnirehtet/index.vue'
import Rotation from './rotation/index.vue'
import Screenshot from './screenshot/index.vue'
import Terminal from './terminal/index.vue'
import Schedule from './schedule/index.vue'
import Volume from './volume/index.vue'

export default {
  components: {
    ControlBarButton,
    /* eslint-disable vue/no-unused-components */
    Screenshot,
    Install,
    Launch,
    Gnirehtet,
    Rotation,
    Volume,
    Explorer,
    Terminal,
    Schedule,
    /* eslint-enable vue/no-unused-components */
  },
  props: {
    device: {
      type: Object,
      default: () => ({}),
    },
    floating: {
      type: Boolean,
      default: false,
    },
    vertical: {
      type: Boolean,
      default: false,
    },
    swapyEnabled: {
      type: Boolean,
      default: false,
    },
    buttonHeight: {
      type: Number,
      default: controlBarHeight,
    },
    buttonClass: {
      type: String,
      default: '',
    },
  },
  setup() {
    const controlStore = useControlStore()

    return {
      controlStore,
    }
  },
  data() {
    return {}
  },
  computed: {
    controlModel() {
      const valueMap = {
        switch: {
          label: 'device.control.switch',
          fontIcon: 'i-proicons-menu',
          command: 'input keyevent 187',
        },
        home: {
          label: 'device.control.home',
          fontIcon: 'i-bi-app',
          command: 'input keyevent 3',
        },
        back: {
          label: 'device.control.return',
          fontIcon: 'i-cil-caret-left',
          command: 'input keyevent 4',
        },
        launch: {
          label: 'device.control.launch',
          fontIcon: 'i-famicons-rocket-outline',
          component: 'Launch',
        },
        turnScreenOff: {
          label: 'device.control.turnScreenOff',
          fontIcon: 'i-bi-file-break',
          tips: 'device.control.turnScreenOff.tips',
          trigger: () => {
            window.$preload.scrcpy.helper(this.device.id, '--turn-screen-off')
          },
        },
        notification: {
          label: 'device.control.notification',
          fontIcon: 'i-bi-bell',
          command: 'cmd statusbar expand-notifications',
          tips: 'device.control.notification.tips',
        },
        power: {
          label: 'device.control.power',
          fontIcon: 'i-uiw-poweroff',
          command: 'input keyevent 26',
          tips: 'device.control.power.tips',
        },
        rotation: {
          label: 'device.control.rotation.name',
          fontIcon: 'i-solar-smartphone-rotate-2-outline',
          component: 'Rotation',
        },
        volume: {
          label: 'device.control.volume.name',
          fontIcon: 'i-simple-line-icons-volume-2',
          component: 'Volume',
        },
        screenshot: {
          label: 'device.control.capture',
          fontIcon: 'i-simple-line-icons-camera',
          component: 'Screenshot',
        },
        reboot: {
          label: 'device.control.reboot',
          fontIcon: 'i-iconoir-refresh',
          command: 'reboot',
        },
        install: {
          label: 'device.control.install',
          fontIcon: 'i-bi-file-arrow-up',
          component: 'Install',
        },
        explorer: {
          label: 'device.control.file.name',
          fontIcon: 'i-bi-folder',
          component: 'Explorer',
        },
        terminal: {
          label: 'device.terminal.name',
          fontIcon: 'i-bi-terminal',
          component: 'Terminal',
        },
        schedule: {
          label: 'device.schedule.name',
          fontIcon: 'i-bi-clock',
          component: 'Schedule',
          hiddenKeys: ['floating'],
        },
        gnirehtet: {
          label: 'device.control.gnirehtet',
          fontIcon: 'i-bi-hdd-network',
          component: 'Gnirehtet',
          tips: 'device.control.gnirehtet.tips',
        },
      }

      const isHidden = item =>
        (item.hiddenKeys || []).some(key => this.$props[key])

      const barLayout = [...new Set([...this.controlStore.barLayout, ...Object.keys(valueMap)])]

      const value = barLayout.reduce((arr, key) => {
        const item = valueMap[key]

        if (item && !isHidden(item)) {
          arr.push({
            ...item,
            id: key,
          })
        }

        return arr
      }, [])

      return value
    },
    buttonStyle() {
      if (this.vertical) {
        return { height: `${this.buttonHeight}px !important`, width: '100%' }
      }
      if (!this.buttonHeight) {
        return {}
      }
      return { height: `${this.buttonHeight}px !important` }
    },
    buttonHeightStyle() {
      if (!this.buttonHeight) {
        return {}
      }

      return {
        height: `${this.buttonHeight}px !important`,
      }
    },
  },
  methods: {
    handlePrev() {
      this.$refs.scrollableRef.scrollBackward()
    },
    handleNext() {
      this.$refs.scrollableRef.scrollForward()
    },
    onSwapEnd(event) {
      const value = event.slotItemMap.asArray.map(obj => obj.item)

      this.controlStore.setBarLayout(value)
    },
  },
}
</script>

<style lang="postcss" scoped>
.el-button.is-disabled {
  @apply !dark:bg-gray-800;
}

.el-button.el-button-nav {
  @apply !flex-none !flex !items-center !justify-center;
  @apply !w-4 !p-0;
  @apply !border-0 !rounded-none;
  @apply !opacity-0 !group-hover:opacity-100 !transition-opacity;
  @apply !bg-primary-100 !dark:bg-gray-800;
  @apply !hover:bg-primary-300 !active:bg-primary-500;
  @apply !text-primary-600 !hover:text-white;
}
</style>
