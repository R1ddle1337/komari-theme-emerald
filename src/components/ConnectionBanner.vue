<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'

const appStore = useAppStore()
const nodesStore = useNodesStore()

// connectionError 表示轮询已失败（WS 和 POST 模式下数据都停更）；
// reconnecting 时轮询仍在兜底，仅提示实时通道中断
const banner = computed(() => {
  if (appStore.loading)
    return null
  if (appStore.connectionError) {
    return {
      tone: 'error' as const,
      icon: 'tabler:plug-connected-x',
      text: '连接服务器失败，数据已停止更新',
    }
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
        class="pointer-events-auto flex items-center gap-1.5 h-7 px-3 rounded-full text-xs backdrop-blur-xl shadow-sm ring-1 whitespace-nowrap"
        :class="banner.tone === 'error'
          ? 'bg-red-500/15 text-red-600 ring-red-500/20'
          : 'bg-amber-500/15 text-amber-600 ring-amber-500/20'"
        role="status"
      >
        <Icon :icon="banner.icon" width="13" height="13" :class="banner.tone === 'warn' && 'animate-spin'" />
        {{ banner.text }}
      </div>
    </div>
  </Transition>
</template>
