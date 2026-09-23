<script setup lang="ts">
import type { Arc, COBEOptions, Globe } from 'cobe'
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { useDocumentVisibility, useElementSize, useElementVisibility, useRafFn } from '@vueuse/core'
import createGlobe from 'cobe'
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { getCoordByCode, getCountryCodeFromRegion } from '@/utils/geoHelper'
import { perfTier } from '@/utils/perfTier'
import { getRegionDisplayName } from '@/utils/regionHelper'

const props = defineProps<{ nodes: NodeData[] }>()
const app = useAppStore()
const container = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()
const { width, height } = useElementSize(container)
const visibility = useDocumentVisibility()
const inView = useElementVisibility(container)
const active = ref(true)
const failed = ref(false)
const paused = ref(false)
const rotating = computed(() => !paused.value && !app.stopEarth && perfTier.value !== 'low')
const regions = computed(() => {
  const groups = new Map<string, { code: string, name: string, total: number, online: number, coord: [number, number] }>()
  for (const node of props.nodes) {
    const code = getCountryCodeFromRegion(node.region)
    const coord = getCoordByCode(code)
    if (!code || !coord)
      continue
    const region = groups.get(code) ?? { code, coord, name: getRegionDisplayName(node.region), total: 0, online: 0 }
    region.total++
    region.online += Number(node.online)
    groups.set(code, region)
  }
  return [...groups.values()].sort((a, b) => b.online - a.online || b.total - a.total)
})
const online = computed(() => props.nodes.filter(node => node.online).length)
const colors = computed(() => app.isDark
  ? { dark: 1, baseColor: [0.12, 0.16, 0.3], glowColor: [0.05, 0.08, 0.2], markerColor: [0.4, 0.75, 1], arcColor: [0.4, 0.7, 1], mapBrightness: 8 }
  : { dark: 0, baseColor: [0.97, 0.97, 1], glowColor: [0.9, 0.93, 1], markerColor: [0.18, 0.45, 0.9], arcColor: [0.18, 0.45, 0.9], mapBrightness: 7 })
const markers = computed(() => regions.value.map(region => ({
  location: region.coord,
  size: 0.05,
  color: (region.online ? colors.value.markerColor : [0.55, 0.60, 0.70]) as [number, number, number],
})))

// Region arcs retain the original globe's visual signature. They illustrate
// geographic distribution, not measured network connections.
const arcs = computed<Arc[]>(() => {
  const [hub, ...others] = [...regions.value].sort((a, b) => b.total - a.total || a.code.localeCompare(b.code))
  return hub ? others.map(region => ({ from: hub.coord, to: region.coord })) : []
})

const initialPhi = -Math.PI / 2 - 105 * Math.PI / 180
let phi = initialPhi
let theta = 0.20
let targetPhi = phi
let targetTheta = theta
let dragging = false
let previousX = 0
let previousY = 0
let globe: Globe | undefined
let dirty = true
let paletteDirty = true
function palette(): Partial<COBEOptions> {
  return { ...colors.value, baseColor: colors.value.baseColor as [number, number, number], glowColor: colors.value.glowColor as [number, number, number], markerColor: colors.value.markerColor as [number, number, number], arcColor: colors.value.arcColor as [number, number, number] }
}
function draw() {
  if (!globe)
    return
  globe.update({ ...(paletteDirty ? { ...palette(), markers: markers.value, arcs: arcs.value } : {}), phi, theta, width: width.value || 320, height: height.value || 320 })
  paletteDirty = false
  dirty = false
}
const { pause, resume } = useRafFn(({ delta }) => {
  if (!globe)
    return
  if (rotating.value && !dragging)
    targetPhi += Math.min(delta, 64) * 0.000045
  const changed = Math.abs(phi - targetPhi) + Math.abs(theta - targetTheta) > 0.00001
  if (!dirty && !changed)
    return
  phi += (targetPhi - phi) * 0.16
  theta += (targetTheta - theta) * 0.16
  draw()
}, { immediate: false, fpsLimit: 30 })
const visible = computed(() => active.value && inView.value && visibility.value === 'visible' && !failed.value)
watch(visible, value => value ? resume() : pause())
watch(rotating, (value) => {
  if (!value) {
    targetPhi = phi
    targetTheta = theta
  }
})
watch([width, height], () => {
  dirty = true
})
watch([colors, () => regions.value.map(region => `${region.code}:${region.online}:${region.total}`).join('|')], () => {
  paletteDirty = true
  dirty = true
})
function start() {
  if (!canvas.value)
    return
  try {
    globe?.destroy()
    globe = createGlobe(canvas.value, {
      width: width.value || 320,
      height: height.value || 320,
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, perfTier.value === 'low' ? 1 : 1.5),
      phi,
      theta,
      diffuse: 1.6,
      mapSamples: window.innerWidth < 768 ? 8000 : 14000,
      mapBrightness: colors.value.mapBrightness,
      dark: colors.value.dark,
      baseColor: colors.value.baseColor as [number, number, number],
      markerColor: colors.value.markerColor as [number, number, number],
      glowColor: colors.value.glowColor as [number, number, number],
      markers: markers.value,
      arcs: arcs.value,
      arcColor: colors.value.arcColor as [number, number, number],
      arcWidth: 1,
      arcHeight: 0.4,
      markerElevation: 0,
      scale: 1,
      opacity: 1,
    })
    failed.value = false
    dirty = true
    draw()
    if (visible.value)
      resume()
  }
  catch {
    failed.value = true
    pause()
  }
}
function pointerDown(event: PointerEvent) {
  dragging = true
  previousX = event.clientX
  previousY = event.clientY
  canvas.value?.setPointerCapture(event.pointerId)
}
function pointerMove(event: PointerEvent) {
  if (!dragging)
    return
  targetPhi += (event.clientX - previousX) / 160
  targetTheta = Math.max(-0.65, Math.min(0.65, targetTheta + (event.clientY - previousY) / 220))
  previousX = event.clientX
  previousY = event.clientY
}
function pointerUp() {
  dragging = false
}
function reset() {
  targetPhi = initialPhi
  targetTheta = 0.20
  dirty = true
}
function keyRotate(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    targetPhi += event.key === 'ArrowLeft' ? -0.25 : 0.25
  }
}
onMounted(() => {
  start()
})
onActivated(() => {
  active.value = true
})
onDeactivated(() => {
  active.value = false
  pause()
})
onBeforeUnmount(() => {
  pause()
  globe?.destroy()
})
</script>

<template>
  <div class="network-globe relative isolate flex h-full min-h-64 flex-col">
    <div class="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-3 pt-2">
      <div>
        <div class="flex items-center gap-2 rounded-full bg-card/80 px-2.5 py-1 text-xs font-medium">
          <Icon icon="tabler:world" width="16" class="text-blue-600 dark:text-sky-300" />全球节点
        </div>
        <div class="mt-1 pl-2.5 text-[11px] text-muted-foreground">
          覆盖 {{ regions.length }} 个地区 · {{ online }} 台在线
        </div>
      </div>
      <div v-if="!failed" class="flex items-center gap-1">
        <button v-if="!app.stopEarth && perfTier !== 'low'" type="button" class="rounded-full border border-border bg-card/80 p-1.5 text-muted-foreground hover:bg-card focus-visible:outline-2" :aria-label="paused ? '继续地球旋转' : '暂停地球旋转'" @click="paused = !paused">
          <Icon :icon="paused ? 'tabler:player-play' : 'tabler:player-pause'" width="13" />
        </button>
        <button type="button" aria-label="重置地球视角" class="rounded-full border border-border bg-card/80 p-1.5 text-muted-foreground hover:bg-card focus-visible:outline-2" @click="reset">
          <Icon icon="tabler:rotate-clockwise" width="13" />
        </button>
      </div>
    </div>
    <div ref="container" class="globe-stage relative mx-auto -mb-4 aspect-square w-[min(100%,360px)] shrink-0">
      <div class="globe-halo pointer-events-none absolute inset-0" aria-hidden="true" />
      <canvas v-show="!failed" ref="canvas" tabindex="0" role="img" aria-label="全球节点分布地球，可拖动或使用左右方向键旋转" class="relative z-1 size-full cursor-grab touch-pan-y focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @keydown="keyRotate" @webglcontextlost.prevent="failed = true; pause()" @webglcontextrestored="start" />
      <div v-if="failed" class="absolute inset-[18%] flex items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
        <Icon icon="tabler:world" width="100" />
      </div>
    </div>
    <div class="relative z-10 mx-auto mt-auto flex max-w-full flex-wrap justify-center gap-x-3 gap-y-1.5 rounded-full bg-card/80 px-3 py-1.5 text-[10px] text-muted-foreground">
      <span v-for="region in regions.slice(0, 5)" :key="region.code" class="flex items-center gap-1" :title="`${region.name}：${region.online} / ${region.total} 在线`"><img :src="`/images/flags/${region.code}.svg`" alt="" class="size-3">{{ region.name }}<span class="font-medium text-foreground">{{ region.online }}</span></span>
    </div>
  </div>
</template>

<style scoped>
.globe-stage canvas {
  contain: layout paint;
}
.globe-halo {
  background: radial-gradient(
    circle at 50% 50%,
    oklch(0.6 0.15 250 / 0.16) 0%,
    oklch(0.6 0.15 250 / 0.06) 38%,
    oklch(0.6 0.15 250 / 0.12) 47%,
    transparent 60%
  );
}
:global(.dark) .globe-halo {
  background: radial-gradient(
    circle at 50% 50%,
    oklch(0.5 0.18 250 / 0.22) 0%,
    oklch(0.5 0.18 250 / 0.08) 38%,
    oklch(0.5 0.18 250 / 0.16) 47%,
    transparent 62%
  );
}
</style>
