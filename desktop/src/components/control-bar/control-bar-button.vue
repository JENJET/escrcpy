<template>
  <SwapyItem :class="[buttonClass, vertical ? 'w-full' : 'flex-none']" v-bind="{ slotId: item.id, itemId: item.id }">
    <component :is="item.component || 'div'" v-bind="{ device, floating, vertical }">
      <template #default="{ loading = false, trigger } = {}">
        <el-button
          type="primary" plain class="!border-none !mx-0 !py-0 !min-h-0 bg-transparent !rounded-0"
          :class="[['unauthorized', 'offline'].includes(device.status) ? '!bg-transparent' : '', buttonClass, vertical ? '!w-full' : '']"
          :style="{ ...buttonStyle }" :disabled="['unauthorized', 'offline'].includes(device.status)"
          :title="$t(item.tips || item.label)" :loading="loading" @click="handleClick($event, trigger || item.trigger)"
        >
          <template #icon>
            <el-icon v-if="item.elIcon" :class="item.iconClass">
              <component :is="item.elIcon" />
            </el-icon>
            <i v-else-if="item.fontIcon" :class="item.fontIcon"></i>
          </template>
        </el-button>
      </template>
    </component>
  </SwapyItem>
</template>

<script>
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
  name: 'ControlBarButton',
  components: {
    Install,
    Launch,
    Explorer,
    Gnirehtet,
    Rotation,
    Screenshot,
    Terminal,
    Schedule,
    Volume,
  },
  props: {
    item: { type: Object, required: true },
    device: { type: Object, default: () => ({}) },
    floating: { type: Boolean, default: false },
    buttonClass: { type: String, default: '' },
    buttonStyle: { type: Object, default: () => ({}) },
    vertical: { type: Boolean, default: false },
  },
  methods: {
    handleClick(event, trigger) {
      if (trigger) {
        // Clear hover/active state first, then open native menu after a brief
        // delay. This prevents Electron from keeping :active stuck when the
        // native Menu.popup() steals the mouseup event.
        event?.currentTarget?.blur()
        setTimeout(() => trigger(this.item), 50)
        return
      }
      if (this.item?.command)
        this.$adb.deviceShell(this.device.id, this.item.command)
      else if (this.item?.scrcpyCommand)
        this.$scrcpy.control(this.device.id, { command: this.item.scrcpyCommand })
    },
  },
}
</script>
