<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useNow } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getInitManager } from '@/utils/init'

const appStore = useAppStore()
const nodesStore = useNodesStore()
const now = useNow({ interval: 1000 })
const retrying = ref(false)
const age = computed(() => nodesStore.lastStatusReceivedAt === null ? null : Math.max(0, Math.floor((now.value.getTime() - nodesStore.lastStatusReceivedAt) / 1000)))
const staleAfter = computed(() => Math.max(15, Number(appStore.publicSettings?.theme_settings?.dataUpdateInterval || 3) * 3))
const lastRefresh = computed(() => age.value === null ? '尚未获取状态' : `最后刷新于 ${age.value} 秒前`)

async function retry() {
  if (retrying.value)
    return
  retrying.value = true
  try {
    await getInitManager()?.refresh()
  }
  finally {
    retrying.value = false
  }
}

// connectionError 表示轮询已失败（WS 和 POST 模式下数据都停更）；
// reconnecting 时轮询仍在兜底，仅提示实时通道中断
const banner = computed(() => {
  if (appStore.loading)
    return null
  if (appStore.connectionError) {
    return {
      tone: 'error' as const,
      icon: 'tabler:plug-connected-x',
      text: `连接服务器失败，${lastRefresh.value}`,
    }
  }
  if (age.value !== null && age.value >= staleAfter.value) {
    return { tone: 'warn' as const, icon: 'tabler:clock', text: `数据暂未更新，${lastRefresh.value}` }
  }
  if (nodesStore.wsConnectionState === 'reconnecting') {
    return {
      tone: 'warn' as const,
      icon: 'tabler:refresh',
      text: `实时连接已断开，正在重连（第 ${nodesStore.wsReconnectAttempts} 次）`,
    }
  }
  return null
})
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div v-if="banner" class="fixed top-3.5 inset-x-0 z-50 flex justify-center pointer-events-none">
      <div
        class="pointer-events-auto flex items-center gap-1.5 min-h-7 px-3 py-1 max-w-[calc(100vw-2rem)] rounded-full text-xs shadow-sm ring-1"
        :class="banner.tone === 'error'
          ? 'bg-red-500/15 text-red-600 ring-red-500/20'
          : 'bg-amber-500/15 text-amber-600 ring-amber-500/20'"
        role="status"
      >
        <Icon :icon="banner.icon" width="13" height="13" :class="banner.icon === 'tabler:refresh' && 'animate-spin'" />
        <span>{{ banner.text }}</span>
        <button type="button" :disabled="retrying" class="shrink-0 underline underline-offset-2 disabled:opacity-50 focus-visible:outline-2" @click="retry">
          {{ retrying ? '刷新中' : '重试' }}
        </button>
      </div>
    </div>
  </Transition>
</template>
