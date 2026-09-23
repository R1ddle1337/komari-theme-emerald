<script setup lang="ts">
import type { COBEOptions, Globe } from 'cobe'
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
  ? { dark: 1, baseColor: [0.11, 0.29, 0.28], glowColor: [0.08, 0.21, 0.20], markerColor: [0.38, 1, 0.79], mapBrightness: 5.5 }
  : { dark: 0, baseColor: [0.53, 0.80, 0.72], glowColor: [0.76, 0.92, 0.85], markerColor: [0.06, 0.55, 0.40], mapBrightness: 2.8 })
const markers = computed(() => regions.value.map(region => ({
  location: region.coord,
  size: Math.min(0.085, 0.028 + Math.sqrt(region.total) * 0.009),
  color: (region.online ? colors.value.markerColor : [0.70, 0.55, 0.35]) as [number, number, number],
})))

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
  return { ...colors.value, baseColor: colors.value.baseColor as [number, number, number], glowColor: colors.value.glowColor as [number, number, number], markerColor: colors.value.markerColor as [number, number, number] }
}
function draw() {
  if (!globe)
    return
  globe.update({ ...(paletteDirty ? { ...palette(), markers: markers.value } : {}), phi, theta, width: width.value || 320, height: height.value || 320 })
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
      diffuse: 1.35,
      mapSamples: 18000,
      mapBrightness: colors.value.mapBrightness,
      dark: colors.value.dark,
      baseColor: colors.value.baseColor as [number, number, number],
      markerColor: colors.value.markerColor as [number, number, number],
      glowColor: colors.value.glowColor as [number, number, number],
      markers: markers.value,
      scale: 1.02,
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
  <div class="network-globe relative isolate flex h-full min-h-64 flex-col overflow-hidden rounded-2xl border border-primary/15">
    <div class="relative z-10 flex items-start justify-between px-5 pt-4">
      <div>
        <div class="flex items-center gap-2 text-sm font-semibold">
          <Icon icon="tabler:world" width="16" class="text-primary" />全球节点
        </div>
        <div class="mt-1 text-[11px] text-muted-foreground">
          覆盖 {{ regions.length }} 个地区 · {{ online }} 台在线
        </div>
      </div>
      <div v-if="!failed" class="flex items-center gap-1">
        <button v-if="!app.stopEarth && perfTier !== 'low'" type="button" class="rounded-full border border-primary/10 bg-card/70 p-1.5 text-primary hover:bg-card focus-visible:outline-2" :aria-label="paused ? '继续地球旋转' : '暂停地球旋转'" @click="paused = !paused">
          <Icon :icon="paused ? 'tabler:player-play' : 'tabler:player-pause'" width="13" />
        </button>
        <button type="button" aria-label="重置地球视角" class="rounded-full border border-primary/10 bg-card/70 p-1.5 text-primary hover:bg-card focus-visible:outline-2" @click="reset">
          <Icon icon="tabler:rotate-clockwise" width="13" />
        </button>
      </div>
    </div>
    <div ref="container" class="relative mx-auto -my-7 aspect-square w-[min(100%,260px)] flex-1">
      <div class="globe-orbit pointer-events-none absolute inset-[13%] rounded-full border border-primary/15" aria-hidden="true" />
      <canvas v-show="!failed" ref="canvas" tabindex="0" role="img" aria-label="全球节点分布地球，可拖动或使用左右方向键旋转" class="relative z-1 size-full cursor-grab touch-pan-y rounded-full focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp" @keydown="keyRotate" @webglcontextlost.prevent="failed = true; pause()" @webglcontextrestored="start" />
      <div v-if="failed" class="absolute inset-[18%] flex items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
        <Icon icon="tabler:world" width="100" />
      </div>
    </div>
    <div class="relative z-10 mt-auto flex flex-wrap justify-center gap-x-3 gap-y-1.5 px-4 pb-3 pt-2 text-[10px] text-muted-foreground">
      <span v-for="region in regions.slice(0, 5)" :key="region.code" class="flex items-center gap-1" :title="`${region.name}：${region.online} / ${region.total} 在线`"><img :src="`/images/flags/${region.code}.svg`" alt="" class="size-3">{{ region.name }}<span class="font-medium text-foreground">{{ region.online }}</span></span>
    </div>
  </div>
</template>

<style scoped>
.network-globe {
  background:
    radial-gradient(ellipse at 55% 50%, oklch(0.91 0.065 165 / 0.65), transparent 65%),
    linear-gradient(135deg, var(--card), var(--accent));
}
:global(.dark) .network-globe {
  background:
    radial-gradient(ellipse at 55% 50%, oklch(0.4 0.085 165 / 0.6), transparent 65%),
    linear-gradient(135deg, var(--card), var(--background));
}
.globe-orbit {
  transform: rotate(-28deg) scaleX(1.35) scaleY(0.62);
}
</style>
