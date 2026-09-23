<script setup lang="ts">
import type { NodeData } from '@/stores/nodes'
import type { CurrencyCode } from '@/utils/financeHelper'
import { Icon } from '@iconify/vue'
import { PopoverClose, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import * as financeHelper from '@/utils/financeHelper'
import { formatBytesPerSecondSplit, formatBytesSplit } from '@/utils/helper'

const props = defineProps<{
  nodes?: NodeData[]
  globeNodes?: NodeData[]
}>()
const NodeEarthGlobe = defineAsyncComponent(() => import('@/components/NodeEarthGlobe.vue'))
const earthOpen = ref(false)

const appStore = useAppStore()
const nodesStore = useNodesStore()
const exchangeRates = ref(financeHelper.DEFAULT_EXCHANGE_RATES)
const exchangeRateBaseCurrency = ref<CurrencyCode>('CNY')
const excludeFreeNodes = ref(true)
const financeRateCurrencies: CurrencyCode[] = ['CNY', 'USD', 'HKD', 'EUR', 'GBP', 'JPY']
const summaryNodes = computed(() => props.nodes ?? nodesStore.nodes)
function setExchangeRateBaseCurrency(event: Event): void {
  const target = event.target as HTMLSelectElement
  exchangeRateBaseCurrency.value = financeHelper.normalizeCurrency(target.value)
  financeHelper.setStoredFinanceCurrency(exchangeRateBaseCurrency.value)
}

const totalSpeed = computed(() => {
  const onlineNodes = summaryNodes.value.filter(node => node.online)
  const up = onlineNodes.reduce((sum, node) => sum + (node.net_out || 0), 0)
  const down = onlineNodes.reduce((sum, node) => sum + (node.net_in || 0), 0)
  return { up, down }
})

const totalTraffic = computed(() => {
  const up = summaryNodes.value.reduce((sum, node) => sum + (node.net_total_up || 0), 0)
  const down = summaryNodes.value.reduce((sum, node) => sum + (node.net_total_down || 0), 0)
  return { up, down }
})

// ==================== 连接数汇总 ====================
const totalConnections = computed(() => {
  const onlineNodes = summaryNodes.value.filter(node => node.online)
  const tcp = onlineNodes.reduce((sum, node) => sum + (node.connections || 0), 0)
  const udp = onlineNodes.reduce((sum, node) => sum + (node.connections_udp || 0), 0)
  return { tcp, udp, total: tcp + udp }
})

function formatNumber(num: number): string {
  if (num >= 100000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString('zh-CN')
}

const formattedTrafficUp = computed(() => formatBytesSplit(totalTraffic.value.up, appStore.byteDecimals))
const formattedTrafficDown = computed(() => formatBytesSplit(totalTraffic.value.down, appStore.byteDecimals))
const totalTrafficTooltip = computed(() => formatBytesSplit(totalTraffic.value.up + totalTraffic.value.down, appStore.byteDecimals))

const formattedSpeedUp = computed(() => formatBytesPerSecondSplit(totalSpeed.value.up, appStore.byteDecimals))
const formattedSpeedDown = computed(() => formatBytesPerSecondSplit(totalSpeed.value.down, appStore.byteDecimals))

// ==================== 内存 / 硬盘 汇总 ====================
// 离线节点的 ram / disk 为 0，不影响 used 求和；mem_total / disk_total 是静态库存信息，按全量统计
const totalMemory = computed(() => {
  let used = 0
  let total = 0
  for (const node of summaryNodes.value) {
    used += node.ram || 0
    total += node.mem_total || 0
  }
  return { used, total }
})

const totalDisk = computed(() => {
  let used = 0
  let total = 0
  for (const node of summaryNodes.value) {
    used += node.disk || 0
    total += node.disk_total || 0
  }
  return { used, total }
})

const formattedMemoryUsed = computed(() => formatBytesSplit(totalMemory.value.used, appStore.byteDecimals))
const formattedMemoryTotal = computed(() => formatBytesSplit(totalMemory.value.total, appStore.byteDecimals))
const formattedDiskUsed = computed(() => formatBytesSplit(totalDisk.value.used, appStore.byteDecimals))
const formattedDiskTotal = computed(() => formatBytesSplit(totalDisk.value.total, appStore.byteDecimals))

const remainingValueCNY = computed(() => {
  return financeHelper.calculateTotalRemainingValueCNY(summaryNodes.value, exchangeRates.value, excludeFreeNodes.value)
})
const targetExchangeRate = computed(() => exchangeRates.value[exchangeRateBaseCurrency.value] || 1)
const remainingValue = computed(() => {
  return remainingValueCNY.value * targetExchangeRate.value
})
const formattedRemainingValue = computed(() => {
  return financeHelper.formatFinanceAmount(remainingValue.value, exchangeRateBaseCurrency.value)
})
const totalValueCNY = computed(() => {
  return financeHelper.calculateTotalValueCNY(summaryNodes.value, exchangeRates.value, excludeFreeNodes.value)
})
const totalValue = computed(() => {
  return totalValueCNY.value * targetExchangeRate.value
})
const formattedTotalValue = computed(() => {
  return financeHelper.formatFinanceAmount(totalValue.value, exchangeRateBaseCurrency.value)
})
const monthlyAverageCostCNY = computed(() => {
  return financeHelper.calculateTotalMonthlyAverageCostCNY(summaryNodes.value, exchangeRates.value, excludeFreeNodes.value)
})
const monthlyAverageCost = computed(() => {
  return monthlyAverageCostCNY.value * targetExchangeRate.value
})
const formattedMonthlyAverageCost = computed(() => {
  return financeHelper.formatFinanceAmount(monthlyAverageCost.value, exchangeRateBaseCurrency.value)
})
const financeSummaryItems = computed(() => [
  {
    label: '总价值',
    icon: 'tabler:wallet',
    value: formattedTotalValue.value.value,
    symbol: formattedTotalValue.value.symbol,
    currency: formattedTotalValue.value.currency,
  },
  {
    label: '月均支出',
    icon: 'tabler:receipt-2',
    value: formattedMonthlyAverageCost.value.value,
    symbol: formattedMonthlyAverageCost.value.symbol,
    currency: `${formattedMonthlyAverageCost.value.currency}/月`,
  },
  {
    label: '剩余价值',
    icon: 'tabler:coins',
    value: formattedRemainingValue.value.value,
    symbol: formattedRemainingValue.value.symbol,
    currency: formattedRemainingValue.value.currency,
  },
])
const exchangeRateRows = computed(() => financeRateCurrencies.map((currency) => {
  const baseRate = exchangeRates.value[exchangeRateBaseCurrency.value] || 1
  const targetRate = exchangeRates.value[currency] || 1
  const rate = targetRate / baseRate

  return {
    currency,
    baseCurrency: exchangeRateBaseCurrency.value,
    baseSymbol: financeHelper.CURRENCY_SYMBOLS[exchangeRateBaseCurrency.value],
    targetSymbol: financeHelper.CURRENCY_SYMBOLS[currency],
    rate: new Intl.NumberFormat('zh-CN', {
      maximumFractionDigits: 6,
      minimumFractionDigits: 6,
    }).format(rate),
  }
}))
onMounted(async () => {
  exchangeRateBaseCurrency.value = financeHelper.getStoredFinanceCurrency()
  excludeFreeNodes.value = financeHelper.shouldExcludeFreeNodes()

  const { rates } = await financeHelper.getDailyExchangeRates()
  exchangeRates.value = rates
})
const summaryMetrics = computed(() => {
  const values = {
    memory: { label: '内存用量', icon: 'tabler:cpu', value: `${formattedMemoryUsed.value.value} ${formattedMemoryUsed.value.unit}`, detail: `总计 ${formattedMemoryTotal.value.value} ${formattedMemoryTotal.value.unit}`, hint: '当前用量 / 全部节点配置容量' },
    disk: { label: '硬盘用量', icon: 'tabler:database', value: `${formattedDiskUsed.value.value} ${formattedDiskUsed.value.unit}`, detail: `总计 ${formattedDiskTotal.value.value} ${formattedDiskTotal.value.unit}`, hint: '当前用量 / 全部节点配置容量' },
    finance: { label: '剩余价值', icon: 'tabler:wallet', value: `${formattedRemainingValue.value.symbol}${formattedRemainingValue.value.value}`, detail: formattedRemainingValue.value.currency, hint: '' },
    traffic: { label: '累计流量', icon: 'tabler:arrows-transfer-up', value: `${totalTrafficTooltip.value.value} ${totalTrafficTooltip.value.unit}`, detail: '上行 + 下行', hint: `↑ ${formattedTrafficUp.value.value} ${formattedTrafficUp.value.unit} / ↓ ${formattedTrafficDown.value.value} ${formattedTrafficDown.value.unit}` },
    speedUp: { label: '实时上行', icon: 'tabler:arrow-up-right', value: `${formattedSpeedUp.value.value} ${formattedSpeedUp.value.unit}`, detail: '在线节点合计', hint: '' },
    speedDown: { label: '实时下行', icon: 'tabler:arrow-down-left', value: `${formattedSpeedDown.value.value} ${formattedSpeedDown.value.unit}`, detail: '在线节点合计', hint: '' },
    connections: { label: '连接数', icon: 'tabler:network', value: formatNumber(totalConnections.value.total), detail: 'TCP + UDP', hint: `TCP ${totalConnections.value.tcp} / UDP ${totalConnections.value.udp}` },
  }
  return appStore.summaryCards.map(key => ({ key, ...values[key] }))
})
</script>

<template>
  <section class="px-4 pb-6" aria-label="资源概览">
    <div class="grid grid-cols-2 min-[360px]:grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-6">
      <template v-for="metric in summaryMetrics" :key="metric.key">
        <PopoverRoot v-if="metric.key === 'finance'">
          <PopoverTrigger as-child>
            <button type="button" aria-label="查看费用和汇率" class="rounded-xl border border-border bg-card p-3 sm:p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary">
              <span class="mb-1.5 sm:mb-3 flex items-center justify-between text-xs text-muted-foreground">{{ metric.label }}<Icon :icon="metric.icon" width="16" /></span>
              <span class="block truncate text-lg sm:text-xl font-semibold tracking-tight">{{ metric.value }}</span>
              <span class="mt-1 hidden sm:block text-[11px] text-muted-foreground">{{ metric.detail }} · 查看明细</span>
            </button>
          </PopoverTrigger>
          <PopoverPortal>
            <PopoverContent side="bottom" :side-offset="8" :collision-padding="12" class="z-50 w-[min(23rem,calc(100vw-1.5rem))] rounded-xl border border-border bg-popover p-4 shadow-lg" aria-label="费用和汇率">
              <div class="mb-4 flex items-center justify-between text-sm font-semibold">
                费用概览<PopoverClose aria-label="关闭费用概览" class="rounded p-1 hover:bg-muted">
                  <Icon icon="tabler:x" width="16" />
                </PopoverClose>
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div v-for="item in financeSummaryItems" :key="item.label">
                  <div class="text-xs text-muted-foreground">
                    {{ item.label }}
                  </div>
                  <div class="mt-1 text-sm font-semibold">
                    {{ item.symbol }}{{ item.value }}
                  </div>
                  <div class="text-[10px] text-muted-foreground">
                    {{ item.currency }}
                  </div>
                </div>
              </div>
              <div class="mb-2 mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                <span class="text-muted-foreground">今日汇率</span>
                <select :value="exchangeRateBaseCurrency" class="rounded border bg-card px-2 py-1" aria-label="切换汇率基准币种" @change="setExchangeRateBaseCurrency">
                  <option v-for="currency in financeRateCurrencies" :key="currency" :value="currency">
                    {{ currency }}
                  </option>
                </select>
              </div>
              <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div v-for="row in exchangeRateRows" :key="row.currency" class="flex justify-between">
                  <span class="text-muted-foreground">{{ row.currency }}</span><span>{{ row.targetSymbol }}{{ row.rate }}</span>
                </div>
              </div>
            </PopoverContent>
          </PopoverPortal>
        </PopoverRoot>
        <div v-else class="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4" :title="metric.hint">
          <div class="mb-1.5 sm:mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {{ metric.label }}<Icon :icon="metric.icon" width="16" />
          </div>
          <div class="truncate text-lg sm:text-xl font-semibold tracking-tight">
            {{ metric.value }}
          </div>
          <div class="mt-1 hidden sm:block truncate text-[11px] text-muted-foreground">
            {{ metric.detail }}
          </div>
        </div>
      </template>
    </div>
    <div v-if="!appStore.hideEarth" class="mt-3">
      <button type="button" :aria-expanded="earthOpen" aria-controls="node-distribution" class="flex items-center gap-1.5 rounded text-xs text-muted-foreground hover:text-primary focus-visible:outline-2" @click="earthOpen = !earthOpen">
        <Icon icon="tabler:world" width="14" />节点分布<Icon :icon="earthOpen ? 'tabler:chevron-up' : 'tabler:chevron-down'" width="12" />
      </button>
      <div v-if="earthOpen" id="node-distribution" class="mt-3 overflow-hidden rounded-xl border border-border bg-card">
        <NodeEarthGlobe :nodes="globeNodes" />
      </div>
    </div>
  </section>
</template>
