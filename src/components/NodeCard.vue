<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import PingBars from '@/components/PingBars.vue'
import { Badge } from '@/components/ui/badge'
import { CardX } from '@/components/ui/card-x'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { ProgressThin } from '@/components/ui/progress-thin'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatRelativeTime, formatUptimeWithFormat, getStatus } from '@/utils/helper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { buildPriceTags, parseTags } from '@/utils/tagHelper'

const props = defineProps<{ node: NodeData }>()

const emit = defineEmits<{ click: [] }>()

const appStore = useAppStore()

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes, appStore.byteDecimals)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes, appStore.byteDecimals)
const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'hour')
const offlineTime = computed(() => formatDateTime(props.node.time))

const cpuStatus = computed(() => getStatus(props.node.cpu ?? 0))
const memPercentage = computed(() => (props.node.ram ?? 0) / (props.node.mem_total || 1) * 100)
const memStatus = computed(() => getStatus(memPercentage.value))
const diskPercentage = computed(() => (props.node.disk ?? 0) / (props.node.disk_total || 1) * 100)
const diskStatus = computed(() => getStatus(diskPercentage.value))

const {
  latencyRenderBars,
  lossRenderBars,
  latencyDisplay,
  lossDisplay,
  latencyPanelTooltip,
  lossPanelTooltip,
} = useNodePingDisplay(() => props.node.uuid)

function showTrafficProgress(node: NodeData): boolean {
  return node.traffic_limit > 0
}

const trafficUsedPercentage = computed(() => {
  if (props.node.traffic_limit <= 0)
    return 0
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = props.node
  let used = 0
  switch (traffic_limit_type) {
    case 'up': used = net_total_up
      break
    case 'down': used = net_total_down
      break
    case 'min': used = Math.min(net_total_up, net_total_down)
      break
    case 'max': used = Math.max(net_total_up, net_total_down)
      break
    case 'sum':
    default:
      used = net_total_up + net_total_down
      break
  }
  return Math.min((used / props.node.traffic_limit) * 100, 100)
})

const trafficUsed = computed(() => {
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = props.node
  switch (traffic_limit_type) {
    case 'up': return net_total_up
    case 'down': return net_total_down
    case 'min': return Math.min(net_total_up, net_total_down)
    case 'max': return Math.max(net_total_up, net_total_down)
    case 'sum':
    default: return net_total_up + net_total_down
  }
})

const priceTags = computed(() => buildPriceTags(props.node, appStore.lang))

const isPinned = computed(() => appStore.isNodePinned(props.node.uuid))
const offlineRelative = computed(() => formatRelativeTime(props.node.time))

const customTags = computed(() => parseTags(props.node.tags).map(t => t.text))

function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}
</script>

<template>
  <CardX
    hoverable
    class="node-card w-full cursor-pointer backdrop-blur-xl backdrop-saturate-150 bg-background/40 border-none shadow-[0_0_0_3px] shadow-transparent hover:bg-background/60 hover:shadow-slate-500/10 transition-all duration-200 rounded-lg ring-1 ring-foreground/[0.06] glass-hover-blur"
    :class="[!props.node.online && '!shadow-red-600/20']"
    header-class="max-md:px-3 max-md:py-2.5"
    content-class="max-md:p-3 max-md:pt-0"
    @click="emit('click')"
  >
    <template #header>
      <div class="flex gap-2 min-w-0 items-center">
        <DataTooltip
          placement="right"
          :content="formatUptime(props.node.uptime ?? 0)"
          class="size-2 rounded-full" :class="[props.node.online ? 'bg-green-600' : 'bg-red-600']"
          content-class="whitespace-nowrap"
        >
          <div
            class="animate-ping absolute inset-0 rounded-full opacity-50"
            :class="[props.node.online ? 'bg-green-600' : 'bg-red-600']"
          />
        </DataTooltip>
        <span class="text-md font-bold flex-1 min-w-0 truncate">{{ props.node.name }}</span>
      </div>
    </template>

    <template #header-extra>
      <div class="flex gap-2 items-center">
        <button
          type="button" :aria-label="isPinned ? '取消置顶' : '置顶'"
          class="flex items-center transition-colors"
          :class="isPinned ? 'text-amber-400' : 'text-muted-foreground/40 hover:text-amber-400'"
          @click.stop="appStore.togglePinnedNode(props.node.uuid)"
        >
          <Icon :icon="isPinned ? 'tabler:star-filled' : 'tabler:star'" width="14" height="14" />
        </button>
        <img :src="getOSImage(props.node.os)" :alt="getOSName(props.node.os)" class="size-4">
        <img
          v-if="hasRegion(props.node.region)" :src="`/images/flags/${getRegionCode(props.node.region)}.svg`"
          :alt="getRegionDisplayName(props.node.region)" class="size-5 shrink-0"
        >
      </div>
    </template>

    <template #default>
      <div class="flex flex-col gap-3 max-md:gap-2">
        <div class="gap-3 max-md:gap-x-3 max-md:gap-y-2 grid grid-cols-2">
          <!-- <div class="flex flex-col gap-1 col-span-2">
                <div class="flex gap-2 items-center">
                  <img :src="getOSImage(props.node.os)" :alt="getOSName(props.node.os)" class="size-4">
                  <span class="text-xs">{{ getOSName(props.node.os) }}</span>
                </div>
              </div> -->
          <!-- CPU -->
          <div class="flex flex-col gap-1">
            <div class="w-full text-xs flex flex-row justify-between">
              <span class="text-muted-foreground">
                CPU
              </span>
              <span>{{ (props.node.cpu ?? 0).toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="props.node.cpu ?? 0" :status="cpuStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ props.node.load.toFixed(2) ?? 0 }}, {{ props.node.load5.toFixed(2) ?? 0 }}, {{
                props.node.load15.toFixed(2) ?? 0 }} ({{ props.node.cpu_cores }}c)
            </div>
          </div>

          <!-- 内存 -->
          <div class="flex flex-col gap-1">
            <div class="w-full text-xs flex flex-row justify-between">
              <span class="text-muted-foreground">
                内存
              </span>
              <span>{{ memPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="memPercentage" :status="memStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ formatBytes(props.node.ram ?? 0) }} / {{ formatBytes(props.node.mem_total ?? 0) }}
            </div>
          </div>

          <!-- 硬盘 -->
          <div class="flex flex-col gap-1">
            <div class="w-full text-xs flex flex-row justify-between">
              <span class="text-muted-foreground">
                硬盘
              </span>
              <span>{{ diskPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="diskPercentage" :status="diskStatus" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ formatBytes(props.node.disk ?? 0) }} / {{ formatBytes(props.node.disk_total ?? 0) }}
            </div>
          </div>

          <!-- 流量进度条 -->
          <div class="flex flex-col gap-1">
            <div class="w-full text-xs flex flex-row justify-between">
              <span class="text-muted-foreground">
                流量
              </span>
              <span>{{ trafficUsedPercentage.toFixed(1) }}%</span>
            </div>
            <ProgressThin :percentage="trafficUsedPercentage" status="success" :height="4" />
            <div class="text-[11px] text-muted-foreground truncate">
              {{ formatBytes(trafficUsed) }} /
              <template v-if="showTrafficProgress(node)">
                {{ formatBytes(props.node.traffic_limit) }}
              </template>
              <template v-else>
                ∞
              </template>
            </div>
          </div>
        </div>
        <div class="gap-1.5 grid grid-cols-6 relative">
          <div
            v-if="!props.node.online"
            class="absolute inset-0 flex flex-col gap-1 items-center justify-center z-1 text-center" aria-hidden="true"
          >
            <div class="text-sm font-medium text-destructive">
              离线{{ offlineRelative !== '-' ? ` ${offlineRelative}` : '' }}
            </div>
            <div class="text-xs text-muted-foreground">
              {{ offlineTime }}
            </div>
          </div>
          <div
            class="flex flex-col gap-0.5 p-1 pl-2 rounded-sm bg-slate-500/5 col-span-2"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '']"
          >
            <div class="text-[11px] flex flex-col">
              <div class="text-green-600 flex flex-row items-center gap-1">
                <Icon icon="tabler:chevron-up" width="12" height="12" />
                {{ formatBytesPerSecond(props.node.net_out ?? 0) }}
              </div>
              <div class="text-blue-600 flex flex-row items-center gap-1">
                <Icon icon="tabler:chevron-down" width="12" height="12" />
                {{ formatBytesPerSecond(props.node.net_in ?? 0) }}
              </div>
            </div>
          </div>
          <div
            class="flex flex-col gap-0.5 p-1 pl-2 rounded-sm bg-slate-500/5"
            :class="[appStore.showNodeConnections ? 'col-span-2' : 'col-span-4', !props.node.online ? 'blur-xs opacity-60' : '']"
          >
            <div class="text-[11px] text-muted-foreground flex flex-col">
              <div class="flex flex-row items-center gap-1">
                <Icon icon="tabler:upload" width="12" height="12" />
                {{ formatBytes(props.node.net_total_up ?? 0) }}
              </div>
              <div class="flex flex-row items-center gap-1">
                <Icon icon="tabler:download" width="12" height="12" />
                {{ formatBytes(props.node.net_total_down ?? 0) }}
              </div>
            </div>
          </div>
          <div
            v-if="appStore.showNodeConnections"
            class="flex flex-col gap-0.5 p-1 pl-2 rounded-sm bg-slate-500/5 col-span-2"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '']"
          >
            <div class="text-[11px] text-muted-foreground flex flex-col">
              <div class="flex flex-row items-center gap-1">
                <span class="text-[10px] font-medium text-muted-foreground/70">TCP</span>
                {{ (props.node.connections ?? 0).toLocaleString() }}
              </div>
              <div class="flex flex-row items-center gap-1">
                <span class="text-[10px] font-medium text-muted-foreground/70">UDP</span>
                {{ (props.node.connections_udp ?? 0).toLocaleString() }}
              </div>
            </div>
          </div>
          <div
            v-if="priceTags.length" class="col-span-6 flex flex-row gap-0.5 p-1 pl-2 rounded-sm bg-slate-500/5 justify-center"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '', appStore.showNodeUptime ? 'max-md:col-span-3' : '']"
          >
            <div class="text-[11px] text-muted-foreground flex flex-row gap-3 max-md:gap-1.5 max-md:flex-wrap max-md:justify-center overflow-hidden">
              <span
                v-for="(tag, index) in priceTags" :key="index" class="whitespace-nowrap"
                :class="tag.tone === 'danger' ? 'text-red-500 font-medium' : tag.tone === 'warn' ? 'text-amber-500' : ''"
              >
                {{ tag.text }}
              </span>
            </div>
          </div>
          <!-- 在线时长（移动端与价格并排一行，省一行高度） -->
          <div
            v-if="appStore.showNodeUptime"
            class="col-span-6 flex flex-row gap-2 items-center p-1 rounded-sm bg-slate-500/5 justify-center text-[11px] text-muted-foreground"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '', priceTags.length ? 'max-md:col-span-3' : '']"
          >
            <Icon icon="tabler:clock-hour-4" width="12" height="12" />
            <span>{{ formatUptime(props.node.uptime ?? 0) }}</span>
          </div>
          <!-- 延迟 -->
          <div
            class="group/panel relative col-span-3 flex flex-col gap-1.5 p-1.5 h-10 rounded-sm bg-slate-500/5"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '']" :title="latencyPanelTooltip"
          >
            <div class="flex items-center justify-between gap-2 text-[11px] leading-none relative">
              <span class="text-muted-foreground">延迟</span>
              <span class="font-medium text-foreground/85">{{ latencyDisplay }}</span>
            </div>
            <div class="h-full min-h-0 opacity-80 group-hover/panel:opacity-100">
              <PingBars :bars="latencyRenderBars" />
            </div>
          </div>
          <!-- 丢包 -->
          <div
            class="group/panel relative col-span-3 flex flex-col gap-1.5 p-1.5 h-10 rounded-sm bg-slate-500/5"
            :class="[!props.node.online ? 'blur-xs opacity-60' : '']" :title="lossPanelTooltip"
          >
            <div class="flex items-center justify-between gap-2 text-[11px] leading-none">
              <span class="text-muted-foreground">丢包</span>
              <span class="font-medium text-foreground/85">{{ lossDisplay }}</span>
            </div>
            <div class="h-full min-h-0 opacity-80 group-hover/panel:opacity-100">
              <PingBars :bars="lossRenderBars" />
            </div>
          </div>
        </div>
        <div v-if="customTags.length > 0" class="flex shrink-0 flex-wrap gap-1 items-center">
          <Badge
            v-for="(tag, index) in customTags" :key="index" variant="outline"
            class="!text-[11px] rounded text-muted-foreground border-muted-foreground/10 px-1.5"
          >
            {{ tag }}
          </Badge>
        </div>
      </div>
    </template>
  </CardX>
</template>

<style scoped>
.node-card {
  position: relative;
  overflow: hidden;
}

.node-offline-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  pointer-events: none;
  border-radius: inherit;
  background-color: var(--card);
  transition: opacity 200ms ease;
}

.node-card:hover .node-offline-overlay {
  opacity: 0;
}

.node-offline-overlay__content {
  display: flex;
  max-width: 100%;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.node-offline-overlay__header,
.node-offline-overlay__tags {
  max-width: 100%;
}
</style>
