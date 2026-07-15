<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import { Icon } from '@iconify/vue'
import { useMediaQuery } from '@vueuse/core'
import { computed, ref } from 'vue'
import NodePingListCell from '@/components/NodePingListCell.vue'
import TrafficProgress from '@/components/TrafficProgress.vue'
import { Badge } from '@/components/ui/badge'
import { DataTooltip } from '@/components/ui/data-tooltip'
import { ProgressThin } from '@/components/ui/progress-thin'
import { useAppStore } from '@/stores/app'
import { formatBytesPerSecondWithConfig, formatBytesWithConfig, formatDateTime, formatUptimeWithFormat, getStatus } from '@/utils/helper'
import { getTrafficUsed, sortNodes } from '@/utils/nodeSortHelper'
import { getOSImage, getOSName } from '@/utils/osImageHelper'
import { getRegionCode, getRegionDisplayName } from '@/utils/regionHelper'
import { formatPriceWithCycle, getDaysUntilExpired, getExpireStatus, parseTags } from '@/utils/tagHelper'

interface ColumnConfig {
  key: string
  label: string
  width: string | number
  sortable: boolean
}

const props = defineProps<{
  nodes: NodeData[]
  transitionKey?: string
}>()

const emit = defineEmits<{ click: [node: NodeData] }>()

const rowStaggerMs = 35
const rowStaggerLimit = 12

const appStore = useAppStore()

const columns: ColumnConfig[] = [
  { key: 'status', label: '状态', width: '36px', sortable: false },
  { key: 'os', label: '系统', width: '36px', sortable: false },
  { key: 'name', label: '节点', width: 'minmax(170px, 1.2fr)', sortable: true },
  { key: 'uptime', label: '运行时间', width: 'minmax(100px, 0.6fr)', sortable: true },
  { key: 'cpu', label: 'CPU', width: 'minmax(110px, 1fr)', sortable: true },
  { key: 'mem', label: '内存', width: 'minmax(120px, 1fr)', sortable: true },
  { key: 'disk', label: '硬盘', width: 'minmax(120px, 1fr)', sortable: true },
  { key: 'traffic', label: '流量', width: 'minmax(120px, 1fr)', sortable: true },
  { key: 'rate', label: '速率', width: 'minmax(100px, 0.7fr)', sortable: true },
]

// <768px 时表格改为移动端紧凑行布局，避免 9 列网格横向滚动
const isDesktop = useMediaQuery('(min-width: 768px)')

const sortableColumns = columns.filter(c => c.sortable)

const sortKey = ref<string>('')
const sortDir = ref<1 | -1>(1)

function handleSort(col: ColumnConfig) {
  if (!col.sortable)
    return
  if (sortKey.value === col.key) {
    sortDir.value = sortDir.value === 1 ? -1 : 1
  }
  else {
    sortKey.value = col.key
    sortDir.value = 1
  }
}

const sortedNodes = computed(() => sortNodes(props.nodes, sortKey.value, sortDir.value))

const formatBytes = (bytes: number) => formatBytesWithConfig(bytes)
const formatBytesPerSecond = (bytes: number) => formatBytesPerSecondWithConfig(bytes)
const formatUptime = (seconds: number) => formatUptimeWithFormat(seconds, 'hour')

const columnKeys = computed(() => columns.map(c => c.key))

const gridStyle = computed(() => ({
  gridTemplateColumns: columns.map(c => c.width).join(' '),
}))

const offlineOverlayContentStyle = computed(() => {
  const keys = columnKeys.value
  const statusIndex = keys.indexOf('status')
  const regionIndex = keys.indexOf('region')
  const nameIndex = keys.indexOf('name')
  const startColumn = nameIndex !== -1
    ? nameIndex + 1
    : regionIndex !== -1
      ? regionIndex + 2
      : statusIndex === -1 ? 1 : statusIndex + 2
  return { gridColumn: `${startColumn} / -1` }
})

function getFlagSrc(region: string): string {
  return `/images/flags/${getRegionCode(region)}.svg`
}

function hasRegion(region: string | null | undefined): boolean {
  return Boolean(region?.trim())
}

function handleClick(node: NodeData) {
  emit('click', node)
}

function getRowTransitionKey(node: NodeData): string {
  return props.transitionKey ? `${props.transitionKey}-${node.uuid}` : node.uuid
}

function getRowTransitionStyle(index: number): Record<string, string> {
  return {
    '--node-row-delay': `${Math.min(index, rowStaggerLimit) * rowStaggerMs}ms`,
  }
}

function showTrafficProgress(node: NodeData): boolean {
  return node.traffic_limit > 0
}

function getTrafficUsedPercentage(node: NodeData): number {
  if (node.traffic_limit <= 0)
    return 0
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = node
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
  return Math.min((used / node.traffic_limit) * 100, 100)
}

function formatOfflineTime(node: NodeData): string {
  return formatDateTime(node.time)
}

function getPriceTags(node: NodeData): Array<string> {
  const tags: Array<string> = []
  const lang = appStore.lang
  if (node.price !== 0) {
    const days = getDaysUntilExpired(node.expired_at)
    const status = getExpireStatus(node.expired_at)
    if (status === 'expired')
      tags.push(lang === 'zh-CN' ? '已过期' : 'Expired')
    else if (status === 'long_term')
      tags.push(lang === 'zh-CN' ? '长期' : 'Long-term')
    else tags.push(lang === 'zh-CN' ? `剩余 ${days} 天` : `${days} days left`)
    const priceText = formatPriceWithCycle(node.price, node.billing_cycle, node.currency, lang)
    tags.push(priceText)
  }
  return tags
}

function getCustomTags(node: NodeData): Array<string> {
  return parseTags(node.tags).map(t => t.text)
}
</script>

<template>
  <div v-if="isDesktop" class="overflow-x-auto overflow-y-hidden min-w-0 p-1 -m-1">
    <div class="min-w-fit w-full flex flex-col gap-1">
      <!-- 表头 -->
      <div class="grid p-2 backdrop-blur-xl backdrop-saturate-150 bg-background/40 rounded-lg ring-1 ring-foreground/[0.06] shadow-sm gap-2" :style="gridStyle">
        <div
          v-for="col in columns" :key="col.key"
          :class="[col.sortable ? 'cursor-pointer' : '', ['status', 'os'].includes(col.key) ? 'text-center' : 'text-left']"
          @click="handleSort(col)"
        >
          <span class="text-xs text-muted-foreground">
            {{ col.label }}{{ col.sortable && sortKey === col.key ? (sortDir === 1 ? ' ↑' : ' ↓') : '' }}
          </span>
        </div>
      </div>

      <TransitionGroup
        :appear="!appStore.disablePageAnimation"
        :css="!appStore.disablePageAnimation"
        name="node-row-switch"
        tag="div"
        class="flex flex-col gap-1"
      >
        <div
          v-for="(node, index) in sortedNodes"
          :key="getRowTransitionKey(node)"
          class="flex flex-col relative h-14 justify-center px-2 cursor-pointer bg-background/30 rounded-lg backdrop-blur-xl shadow-[0_0_0_2px] shadow-transparent hover:shadow-slate-500/10 hover:bg-background/60 transition-all"
          :class="[!node.online && '!shadow-red-600/10']"
          :style="getRowTransitionStyle(index)"
          @click="handleClick(node)"
        >
          <div class="grid gap-2 items-center" :style="gridStyle">
            <template v-for="col in columns" :key="col.key">
              <!-- 在线状态指示器 -->
              <div v-if="col.key === 'status'" class="flex justify-center">
                <div class="size-2 rounded-full relative" :class="[node.online ? 'bg-green-600' : 'bg-red-600']">
                  <div
                    class="animate-ping absolute inset-0 rounded-full opacity-50"
                    :class="[node.online ? 'bg-green-600' : 'bg-red-600']"
                  />
                </div>
              </div>

              <!-- 节点名称（标签并入第二行，不再占独立列） -->
              <div v-else-if="col.key === 'name'" class="space-y-0.5 min-w-0" :class="[!node.online && 'blur-sm opacity-30']">
                <div class="flex gap-1 items-center text-xs font-semibold">
                  <img
                    v-if="hasRegion(node.region)" :src="getFlagSrc(node.region)"
                    :alt="getRegionDisplayName(node.region)" class="size-5 rounded-sm"
                  >
                  <span class="truncate">{{ node.name }}</span>
                </div>
                <div
                  v-if="getPriceTags(node).length > 0 || getCustomTags(node).length > 0"
                  class="flex gap-1 items-center overflow-hidden whitespace-nowrap"
                >
                  <span
                    v-for="(tag, tagIndex) in getPriceTags(node)" :key="`price-${tagIndex}`"
                    class="text-[11px] text-muted-foreground/70 shrink-0"
                  >
                    {{ tag }}
                  </span>
                  <Badge
                    v-for="(tag, tagIndex) in getCustomTags(node)" :key="`tag-${tagIndex}`" variant="outline"
                    class="!text-[10px] rounded text-muted-foreground border-muted-foreground/10 px-1 py-0 shrink-0"
                  >
                    {{ tag }}
                  </Badge>
                </div>
              </div>

              <!-- 延迟/丢包 -->
              <!-- <div v-else-if="col.key === 'ping'">
              <NodePingListCell :uuid="node.uuid" :online="node.online" />
            </div> -->

              <!-- 运行时间 -->
              <div v-else-if="col.key === 'uptime'" class="flex flex-col gap-0.5">
                <span class="text-[10px] text-muted-foreground truncate">
                  {{ formatUptime(node.uptime ?? 0) }}
                </span>
                <NodePingListCell :uuid="node.uuid" :online="node.online" />
              </div>

              <!-- 操作系统 -->
              <div v-else-if="col.key === 'os'" class="flex justify-center">
                <img :src="getOSImage(node.os)" :alt="getOSName(node.os)" class="size-4">
              </div>

              <!-- CPU -->
              <div v-else-if="col.key === 'cpu'" class="min-w-0">
                <div class="space-y-1">
                  <div class="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                    <span class="shrink-0">{{ (node.cpu ?? 0).toFixed(1) }}%</span>
                    <span class="truncate opacity-70">
                      {{ (node.load ?? 0).toFixed(2) }} {{ (node.load5 ?? 0).toFixed(2) }} {{ (node.load15 ?? 0).toFixed(2) }}
                    </span>
                  </div>
                  <ProgressThin :percentage="node.cpu ?? 0" :status="getStatus(node.cpu ?? 0)" :height="4" />
                </div>
              </div>

              <!-- 内存 -->
              <div v-else-if="col.key === 'mem'" class="min-w-0">
                <div class="space-y-1">
                  <div class="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                    <span class="shrink-0">{{ ((node.ram ?? 0) / (node.mem_total || 1) * 100).toFixed(1) }}%</span>
                    <span class="truncate opacity-70">
                      {{ formatBytes(node.ram ?? 0) }} / {{ formatBytes(node.mem_total ?? 0) }}
                    </span>
                  </div>
                  <ProgressThin
                    :percentage="(node.ram ?? 0) / (node.mem_total || 1) * 100"
                    :status="getStatus((node.ram ?? 0) / (node.mem_total || 1) * 100)" :height="4"
                  />
                </div>
              </div>

              <!-- 硬盘 -->
              <div v-else-if="col.key === 'disk'" class="min-w-0">
                <div class="space-y-1">
                  <div class="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                    <span class="shrink-0">{{ ((node.disk ?? 0) / (node.disk_total || 1) * 100).toFixed(1) }}%</span>
                    <span class="truncate opacity-70">
                      {{ formatBytes(node.disk ?? 0) }} / {{ formatBytes(node.disk_total ?? 0) }}
                    </span>
                  </div>
                  <ProgressThin
                    :percentage="(node.disk ?? 0) / (node.disk_total || 1) * 100"
                    :status="getStatus((node.disk ?? 0) / (node.disk_total || 1) * 100)" :height="4"
                  />
                </div>
              </div>

              <!-- 流量 -->
              <div v-else-if="col.key === 'traffic'" class="min-w-0">
                <DataTooltip placement="top" class="flex items-center gap-2" content-class="mb-1.5">
                  <div class="space-y-1 w-full">
                    <div class="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                      <template v-if="showTrafficProgress(node)">
                        <span class="shrink-0">{{ getTrafficUsedPercentage(node).toFixed(1) }}%</span>
                        <span class="truncate opacity-70">
                          {{ formatBytes(getTrafficUsed(node)) }} / {{ formatBytes(node.traffic_limit) }}
                        </span>
                      </template>
                      <template v-else>
                        <span class="shrink-0">{{ formatBytes(getTrafficUsed(node)) }}</span>
                        <span class="opacity-70">∞</span>
                      </template>
                    </div>
                    <TrafficProgress
                      :upload="node.net_total_up ?? 0" :download="node.net_total_down ?? 0"
                      :traffic-limit="node.traffic_limit" :traffic-limit-type="(node.traffic_limit_type || 'sum')"
                      height="4px"
                    />
                  </div>
                  <template #content>
                    <span class="flex flex-row gap-0.5 items-center whitespace-nowrap">
                      <Icon icon="tabler:chevron-up" width="12" height="12" />
                      {{ formatBytes(node.net_total_up ?? 0) }}
                    </span>
                    <span class="flex flex-row gap-0.5 items-center whitespace-nowrap">
                      <Icon icon="tabler:chevron-down" width="12" height="12" />
                      {{ formatBytes(node.net_total_down ?? 0) }}
                    </span>
                  </template>
                </DataTooltip>
              </div>

              <!-- 速率 -->
              <div v-else-if="col.key === 'rate'">
                <div class="text-[10px] flex flex-col ">
                  <span class="text-green-600 flex flex-row gap-1 items-center">
                    <Icon icon="tabler:chevron-up" width="12" height="12" />
                    {{ formatBytesPerSecond(node.net_out ?? 0) }}
                  </span>
                  <span class="text-blue-600 flex flex-row gap-1 items-center">
                    <Icon icon="tabler:chevron-down" width="12" height="12" />
                    {{ formatBytesPerSecond(node.net_in ?? 0) }}
                  </span>
                </div>
              </div>
            </template>
          </div>

          <div
            v-if="!node.online" class="absolute inset-0 z-2 p-2 bg-background/10 rounded-lg flex items-center"
            aria-hidden="true"
          >
            <div class="grid gap-2 items-center justify-center" :style="gridStyle">
              <div class="h-full space-y-1" :style="offlineOverlayContentStyle">
                <div class="text-sm font-semibold truncate">
                  <span class="text-red-500">离线</span> {{ node.name }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ formatOfflineTime(node) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>

  <!-- 移动端：紧凑行布局，全部信息纵向排布，无横向滚动 -->
  <div v-else class="flex flex-col gap-2 min-w-0">
    <!-- 排序 chips -->
    <div class="sort-chips flex gap-1 overflow-x-auto">
      <button
        v-for="col in sortableColumns" :key="col.key" type="button"
        class="shrink-0 h-6 px-2 rounded-md text-[11px] backdrop-blur-xl bg-background/40 ring-1 ring-foreground/[0.06] transition-colors"
        :class="[sortKey === col.key ? 'text-green-600 bg-background/70' : 'text-muted-foreground']"
        @click="handleSort(col)"
      >
        {{ col.label }}{{ sortKey === col.key ? (sortDir === 1 ? ' ↑' : ' ↓') : '' }}
      </button>
    </div>

    <TransitionGroup
      :appear="!appStore.disablePageAnimation"
      :css="!appStore.disablePageAnimation"
      name="node-row-switch"
      tag="div"
      class="flex flex-col gap-1.5"
    >
      <div
        v-for="(node, index) in sortedNodes"
        :key="getRowTransitionKey(node)"
        class="relative p-2.5 cursor-pointer bg-background/30 rounded-lg backdrop-blur-xl shadow-[0_0_0_2px] shadow-transparent active:bg-background/60 transition-all"
        :class="[!node.online && '!shadow-red-600/10']"
        :style="getRowTransitionStyle(index)"
        @click="handleClick(node)"
      >
        <div class="flex flex-col gap-1.5" :class="[!node.online && 'blur-sm opacity-30']">
          <!-- 第一行：状态 + 旗帜 + 系统 + 名称 | 实时速率 -->
          <div class="flex items-center gap-2 min-w-0">
            <div class="size-2 rounded-full relative shrink-0" :class="[node.online ? 'bg-green-600' : 'bg-red-600']">
              <div
                class="animate-ping absolute inset-0 rounded-full opacity-50"
                :class="[node.online ? 'bg-green-600' : 'bg-red-600']"
              />
            </div>
            <img
              v-if="hasRegion(node.region)" :src="getFlagSrc(node.region)"
              :alt="getRegionDisplayName(node.region)" class="size-5 rounded-sm shrink-0"
            >
            <img :src="getOSImage(node.os)" :alt="getOSName(node.os)" class="size-4 shrink-0">
            <span class="truncate text-xs font-semibold flex-1 min-w-0">{{ node.name }}</span>
            <span class="text-[10px] shrink-0 flex items-center gap-1.5">
              <span class="text-green-600 flex items-center gap-0.5">
                <Icon icon="tabler:chevron-up" width="12" height="12" />
                {{ formatBytesPerSecond(node.net_out ?? 0) }}
              </span>
              <span class="text-blue-600 flex items-center gap-0.5">
                <Icon icon="tabler:chevron-down" width="12" height="12" />
                {{ formatBytesPerSecond(node.net_in ?? 0) }}
              </span>
            </span>
          </div>

          <!-- 第二行：价格/自定义标签（有则显示） -->
          <div
            v-if="getPriceTags(node).length > 0 || getCustomTags(node).length > 0"
            class="flex gap-1 items-center overflow-hidden whitespace-nowrap"
          >
            <span
              v-for="(tag, tagIndex) in getPriceTags(node)" :key="`price-${tagIndex}`"
              class="text-[11px] text-muted-foreground/70 shrink-0"
            >
              {{ tag }}
            </span>
            <Badge
              v-for="(tag, tagIndex) in getCustomTags(node)" :key="`tag-${tagIndex}`" variant="outline"
              class="!text-[10px] rounded text-muted-foreground border-muted-foreground/10 px-1 py-0 shrink-0"
            >
              {{ tag }}
            </Badge>
          </div>

          <!-- 第三行：四个迷你仪表 -->
          <div class="grid grid-cols-4 gap-2">
            <div class="space-y-1 min-w-0">
              <div class="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                <span class="shrink-0">CPU</span>
                <span class="truncate">{{ (node.cpu ?? 0).toFixed(0) }}%</span>
              </div>
              <ProgressThin :percentage="node.cpu ?? 0" :status="getStatus(node.cpu ?? 0)" :height="4" />
            </div>
            <div class="space-y-1 min-w-0">
              <div class="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                <span class="shrink-0">内存</span>
                <span class="truncate">{{ ((node.ram ?? 0) / (node.mem_total || 1) * 100).toFixed(0) }}%</span>
              </div>
              <ProgressThin
                :percentage="(node.ram ?? 0) / (node.mem_total || 1) * 100"
                :status="getStatus((node.ram ?? 0) / (node.mem_total || 1) * 100)" :height="4"
              />
            </div>
            <div class="space-y-1 min-w-0">
              <div class="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                <span class="shrink-0">硬盘</span>
                <span class="truncate">{{ ((node.disk ?? 0) / (node.disk_total || 1) * 100).toFixed(0) }}%</span>
              </div>
              <ProgressThin
                :percentage="(node.disk ?? 0) / (node.disk_total || 1) * 100"
                :status="getStatus((node.disk ?? 0) / (node.disk_total || 1) * 100)" :height="4"
              />
            </div>
            <div class="space-y-1 min-w-0">
              <div class="text-[10px] text-muted-foreground flex items-center justify-between gap-1">
                <span class="shrink-0">流量</span>
                <span v-if="showTrafficProgress(node)" class="truncate">{{ getTrafficUsedPercentage(node).toFixed(0) }}%</span>
                <span v-else class="truncate">{{ formatBytes(getTrafficUsed(node)) }}</span>
              </div>
              <TrafficProgress
                :upload="node.net_total_up ?? 0" :download="node.net_total_down ?? 0"
                :traffic-limit="node.traffic_limit" :traffic-limit-type="(node.traffic_limit_type || 'sum')"
                height="4px"
              />
            </div>
          </div>

          <!-- 第四行：运行时间 + ping 诊断条 -->
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[10px] text-muted-foreground shrink-0">
              {{ formatUptime(node.uptime ?? 0) }}
            </span>
            <div class="flex-1 min-w-0">
              <NodePingListCell :uuid="node.uuid" :online="node.online" />
            </div>
          </div>
        </div>

        <div
          v-if="!node.online" class="absolute inset-0 z-2 p-2 bg-background/10 rounded-lg flex flex-col items-center justify-center gap-0.5"
          aria-hidden="true"
        >
          <div class="text-sm font-semibold truncate max-w-full">
            <span class="text-red-500">离线</span> {{ node.name }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ formatOfflineTime(node) }}
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.sort-chips {
  scrollbar-width: none;
}

.sort-chips::-webkit-scrollbar {
  display: none;
}

.node-row-switch-enter-active,
.node-row-switch-leave-active {
  transition:
    opacity 170ms ease,
    transform 210ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 170ms ease;
}

.node-row-switch-enter-active {
  transition-delay: var(--node-row-delay, 0ms);
}

.node-row-switch-move {
  transition: transform 210ms cubic-bezier(0.22, 1, 0.36, 1);
}

.node-row-switch-enter-from {
  opacity: 0;
  transform: translateY(8px);
  filter: blur(3px);
}

.node-row-switch-leave-to {
  opacity: 0;
  transform: translateY(-5px);
  filter: blur(2px);
}

/* 移动端进场不做 filter blur（同 HomeView 卡片过渡） */
@media (max-width: 767px) {
  .node-row-switch-enter-from,
  .node-row-switch-leave-to {
    filter: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .node-row-switch-enter-active,
  .node-row-switch-leave-active,
  .node-row-switch-move {
    transition: none;
    transition-delay: 0ms;
  }

  .node-row-switch-enter-from,
  .node-row-switch-leave-to {
    opacity: 1;
    transform: none;
    filter: none;
  }
}
</style>
