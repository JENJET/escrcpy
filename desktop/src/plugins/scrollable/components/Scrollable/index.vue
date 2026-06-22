<template>
  <div
    ref="container" class="overflow-auto scrollable"
    :class="{ 'cursor-grab': !isDragging && !disabledDrag, 'cursor-grabbing': isDragging }" @mousedown="startDrag"
    @mousemove="onDrag" @mouseup="endDrag" @mouseleave="endDrag" @wheel="onWheel"
  >
    <div
      ref="content" class="inline-flex" :class="[contentClass, { 'flex-col': direction === 'vertical' }]"
      :style="contentStyle"
    >
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineOptions({
  name: 'Scrollable',
})

const props = defineProps({
  direction: {
    type: String,
    default: 'horizontal',
    validator: value => ['horizontal', 'vertical'].includes(value),
  },
  speed: {
    type: Number,
    default: 1,
  },
  disabledDrag: {
    type: Boolean,
    default: false,
  },
  contentClass: {
    type: [String, Object, Array],
    default: '',
  },
})

const container = ref(null)
const content = ref(null)
const isOverflow = ref(false)
const isDragging = ref(false)
const startX = ref(0)
const startY = ref(0)
const scrollLeft = ref(0)
const scrollTop = ref(0)

let _resizeObserver = null

const contentStyle = computed(() => ({
  transform:
    props.direction === 'horizontal'
      ? `translateX(${-scrollLeft.value}px)`
      : `translateY(${-scrollTop.value}px)`,
  transition: isDragging.value ? 'none' : 'transform 0.3s ease-out',
}))

function checkOverflow() {
  if (!container.value || !content.value)
    return
  if (props.direction === 'horizontal') {
    isOverflow.value = content.value.scrollWidth > container.value.clientWidth + 1
  }
  else {
    isOverflow.value = content.value.scrollHeight > container.value.clientHeight + 1
  }
}

function startDrag(e) {
  if (props.disabledDrag) {
    return false
  }

  isDragging.value = true
  startX.value = e.pageX - container.value.offsetLeft
  startY.value = e.pageY - container.value.offsetTop
  container.value.style.cursor = 'grabbing'
}

function onDrag(e) {
  if (props.disabledDrag) {
    return false
  }

  if (!isDragging.value) {
    return
  }
  e.preventDefault()
  const x = e.pageX - container.value.offsetLeft
  const y = e.pageY - container.value.offsetTop
  const walkX = (x - startX.value) * props.speed
  const walkY = (y - startY.value) * props.speed

  if (props.direction === 'horizontal') {
    scrollLeft.value = Math.max(
      0,
      Math.min(
        scrollLeft.value - walkX,
        content.value.offsetWidth - container.value.offsetWidth,
      ),
    )
  }
  else {
    scrollTop.value = Math.max(
      0,
      Math.min(
        scrollTop.value - walkY,
        content.value.offsetHeight - container.value.offsetHeight,
      ),
    )
  }

  startX.value = x
  startY.value = y
}

function endDrag() {
  if (props.disabledDrag) {
    return false
  }

  isDragging.value = false
  container.value.style.cursor = 'grab'
}

function onWheel(e) {
  e.preventDefault()
  const delta
    = props.direction === 'horizontal' ? e.deltaX || e.deltaY : e.deltaY
  const newScroll
    = (props.direction === 'horizontal' ? scrollLeft.value : scrollTop.value)
      + delta * props.speed

  if (props.direction === 'horizontal') {
    scrollLeft.value = Math.max(
      0,
      Math.min(
        newScroll,
        content.value.offsetWidth - container.value.offsetWidth,
      ),
    )
  }
  else {
    scrollTop.value = Math.max(
      0,
      Math.min(
        newScroll,
        content.value.offsetHeight - container.value.offsetHeight,
      ),
    )
  }
}

function getIncrement() {
  return 100 * props.speed
}

function scrollToStart() {
  const maxScroll = props.direction === 'horizontal'
    ? content.value.offsetWidth - container.value.offsetWidth
    : content.value.offsetHeight - container.value.offsetHeight

  if (maxScroll <= 0) {
    scrollBackward()
  }
  else if (props.direction === 'horizontal') {
    scrollLeft.value = 0
  }
  else {
    scrollTop.value = 0
  }
}

function scrollToEnd() {
  const maxScroll = props.direction === 'horizontal'
    ? content.value.offsetWidth - container.value.offsetWidth
    : content.value.offsetHeight - container.value.offsetHeight

  if (maxScroll <= 0) {
    scrollForward()
  }
  else if (props.direction === 'horizontal') {
    scrollLeft.value = maxScroll
  }
  else {
    scrollTop.value = maxScroll
  }
}

function scrollForward() {
  const increment = getIncrement()
  if (props.direction === 'horizontal') {
    scrollLeft.value = Math.min(
      scrollLeft.value + increment,
      content.value.offsetWidth - container.value.offsetWidth,
    )
  }
  else {
    scrollTop.value = Math.min(
      scrollTop.value + increment,
      content.value.offsetHeight - container.value.offsetHeight,
    )
  }
}

function scrollBackward() {
  const increment = getIncrement()
  if (props.direction === 'horizontal') {
    scrollLeft.value = Math.max(scrollLeft.value - increment, 0)
  }
  else {
    scrollTop.value = Math.max(scrollTop.value - increment, 0)
  }
}

onMounted(() => {
  window.addEventListener('mouseup', endDrag)
  _resizeObserver = new ResizeObserver(() => {
    checkOverflow()
  })
  if (container.value)
    _resizeObserver.observe(container.value)
  if (content.value)
    _resizeObserver.observe(content.value)
})

onUnmounted(() => {
  window.removeEventListener('mouseup', endDrag)
  if (_resizeObserver) {
    _resizeObserver.disconnect()
    _resizeObserver = null
  }
})

defineExpose({
  container,
  isOverflow,
  checkOverflow,
  scrollToStart,
  scrollToEnd,
  scrollForward,
  scrollBackward,
})
</script>

<style>
.scrollable::-webkit-scrollbar {
  display: none;
}
</style>
