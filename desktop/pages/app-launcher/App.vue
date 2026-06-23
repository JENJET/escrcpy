<template>
  <el-config-provider :locale="locale">
    <div class="h-screen w-screen bg-[var(--el-bg-color-overlay)]">
      <div class="app-launcher-panel">
        <AppSelector
          :device-id="currentDevice.id"
          embedded
          with-home
          with-secondary
          label-class="pr-2"
          @change="(pkg, item) => onStartApp(item)"
        >
          <template #actions="{ item }">
            <el-switch
              v-model="launchOrientation.selections[getLaunchKey(item)]"
              class="el-switch--theme mr-[5px]"
              plain
              size="small"
              :title="getOrientationToggleTitle(item)"
              @click.stop
              @mousedown.stop
              @pointerdown.stop
              @change="value => launchOrientation.setEnabled(item, value)"
            >
              <template #active-action>
                <div class="i-fluent-rectangle-landscape-12-regular size-full"></div>
              </template>
              <template #inactive-action>
                <div class="i-fluent-rectangle-portrait-12-regular text-primary-500 size-full"></div>
              </template>
            </el-switch>
            <el-link
              v-if="['win32'].includes(platform)"
              type="primary"
              underline="never"
              icon="TopRight"
              :title="$t('desktop.shortcut.add')"
              @click.stop="onShortcutClick(item)"
            />
            <el-link
              type="primary"
              underline="never"
              icon="Monitor"
              :title="$t('device.control.launch.useMainScreen')"
              @click.stop="onMainStartClick(item)"
            />
          </template>
        </AppSelector>
      </div>
    </div>
  </el-config-provider>
</template>

<script setup>
import { quote } from 'shell-quote'
import AppSelector from '$/components/app-selector/index.vue'
import { useLaunchOrientation } from '$/hooks/useLaunchOrientation/index.js'
import { useStartApp } from '$/hooks/useStartApp/index.js'
import { getLaunchKey, getPackageName } from '$/utils/launch/index.js'

const deviceStore = useDeviceStore()
const startApp = useStartApp()
const platform = window.$preload.process?.platform

const { currentDevice, locale } = useWindowStateSync({ deviceSync: true })
const launchOrientation = useLaunchOrientation({
  lazy: true,
  getDeviceId: () => currentDevice.value.id,
})

function getStartAppOptions(item = {}, extraOptions = {}) {
  const { label, userId, activity } = item
  const packageName = getPackageName(item)

  return {
    deviceId: currentDevice.value.id,
    appName: label,
    packageName,
    userId,
    activity,
    landscape: launchOrientation.isEnabled(item),
    ...extraOptions,
  }
}

function getOrientationToggleTitle(item = {}) {
  const title = launchOrientation.isEnabled(item)
    ? window.t('device.control.rotation.horizontally')
    : window.t('device.control.rotation.vertically')

  return `${window.t('device.control.rotation.name')}: ${title}`
}

function closeWindow() {
  window.$preload.ipcRenderer.send('app-launcher-hide')
}

function onStartApp(item = {}) {
  startApp.open(getStartAppOptions(item))
  closeWindow()
}

function onMainStartClick(item = {}) {
  startApp.open(getStartAppOptions(item, { useNewDisplay: false }))
  closeWindow()
}

function quoteShortcutArgument(value = '') {
  return quote([String(value)])
}

function stringifyShortcutArguments(args = {}) {
  return Object.entries(args)
    .filter(([, value]) => ![undefined, null, ''].includes(value))
    .map(([key, value]) => `--${key}=${quoteShortcutArgument(value)}`)
    .join(' ')
}

function onShortcutClick(item) {
  const startOptions = getStartAppOptions(item)
  const landscape = startOptions.landscape
  const desktopName = deviceStore.getLabel(
    currentDevice.value,
    ({ deviceName }) => `${item.label}${landscape ? '-landscape' : ''}-${deviceName}`,
  )

  const shortcutArguments = stringifyShortcutArguments({
    'device-id': startOptions.deviceId,
    'app-name': startOptions.appName,
    'package-name': startOptions.packageName,
    'user-id': startOptions.userId,
    'activity': startOptions.activity,
    'landscape': landscape ? 1 : '',
  })

  const result = window.$preload.desktop.createShortcuts({
    name: desktopName,
    comment: desktopName,
    arguments: shortcutArguments,
  })

  if (result) {
    ElMessage.success(window.t('common.success'))
    return
  }
  ElMessage.warning(window.t('common.failed'))
}

window.$preload.ipcRenderer.on('app-launcher-open', (event, payload = {}) => {
  currentDevice.value = payload.device || currentDevice.value
  launchOrientation.init()
})

function onKeydown(event) {
  if (event.key === 'Escape') {
    closeWindow()
  }
}

onMounted(() => {
  launchOrientation.init()
  window.addEventListener('keydown', onKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown, true)
})
</script>

<style lang="postcss">
html,
body {
  margin: 0;
  overflow: hidden;
  background-color: var(--el-bg-color-overlay);
}

#app {
  background-color: var(--el-bg-color-overlay);
}

.app-launcher-panel {
  @apply h-full w-full overflow-hidden bg-[var(--el-bg-color-overlay)];
}

.dark .app-launcher-panel {
  background: #1f2023;
}

.app-launcher-panel :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.72);
}

.dark .app-launcher-panel :deep(.el-input__wrapper) {
  background-color: #1b1c1f;
}
</style>
