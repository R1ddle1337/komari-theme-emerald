<script setup lang="ts">
import { onMounted, onUnmounted, watch, watchEffect } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { destroyInitManager, initApp } from '@/utils/init'
import { initPerfTier } from '@/utils/perfTier'
import Background from './components/Background.vue'
import ConnectionBanner from './components/ConnectionBanner.vue'
import Footer from './components/Footer.vue'
import Header from './components/Header.vue'
import LoadingCover from './components/LoadingCover.vue'
import Provider from './components/Provider.vue'

const appStore = useAppStore()
const nodesStore = useNodesStore()
watchEffect(() => {
  document.documentElement.classList.toggle('no-glass', !appStore.enableGlassEffect)
})

// 节点掉线/恢复浏览器通知：首个非空快照只记录基线不通知
const lastOnlineState = new Map<string, boolean>()
let onlineStateSeeded = false
let perfTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => nodesStore.nodes.map(node => `${node.uuid}:${node.online ? 1 : 0}`).join(','),
  () => {
    const nodes = nodesStore.nodes
    if (!onlineStateSeeded) {
      if (!nodes.length)
        return
      for (const node of nodes)
        lastOnlineState.set(node.uuid, node.online)
      onlineStateSeeded = true
      return
    }
    const canNotify = appStore.offlineNotifyEnabled
      && typeof Notification !== 'undefined'
      && Notification.permission === 'granted'
    for (const node of nodes) {
      const prev = lastOnlineState.get(node.uuid)
      if (prev !== undefined && prev !== node.online && canNotify) {
        // eslint-disable-next-line no-new
        new Notification(
          node.online ? `${node.name} 已恢复在线` : `${node.name} 已离线`,
          {
            body: `${appStore.publicSettings?.sitename || 'Komari Monitor'} · ${new Date().toLocaleTimeString()}`,
            icon: '/favicon.ico',
            tag: `komari-node-${node.uuid}`,
          },
        )
      }
      lastOnlineState.set(node.uuid, node.online)
    }
  },
)

// 浏览器标题实时显示在线数
watchEffect(() => {
  const sitename = appStore.publicSettings?.sitename || 'Komari Monitor'
  const total = nodesStore.nodes.length
  if (total > 0) {
    const online = nodesStore.nodes.filter(node => node.online).length
    document.title = `${sitename} · ${online}/${total} 在线`
  }
  else {
    document.title = sitename
  }
})

onMounted(async () => {
  try {
    await initApp()
    // Measure after startup imports and initial painting settle.
    perfTimer = setTimeout(() => {
      void initPerfTier()
    }, 2500)
  }
  catch (error) {
    console.error('[App] Initialization failed:', error)
  }
})

onUnmounted(() => {
  clearTimeout(perfTimer)
  destroyInitManager()
})
</script>

<template>
  <Provider>
    <Background />
    <Transition
      enter-active-class="transition-all duration-100 ease-out" enter-from-class="opacity-0 backdrop-blur-0"
      enter-to-class="opacity-100 backdrop-blur-sm" leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 backdrop-blur-sm" leave-to-class="opacity-0 backdrop-blur-0"
    >
      <LoadingCover v-if="appStore.loading" />
    </Transition>
    <Header />
    <ConnectionBanner />
    <main v-if="!appStore.loading" class="relative z-10 min-h-screen overflow-hidden">
      <div class="max-w-[1440px] mx-auto">
        <RouterView v-slot="{ Component }">
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 translate-x-4 blur-sm" enter-to-class="opacity-100 translate-x-0 blur-0"
            leave-active-class="transition-all duration-200 ease-in" leave-from-class="opacity-100 translate-x-0 blur-0"
            leave-to-class="opacity-0 -translate-x-4 blur-sm" mode="out-in"
          >
            <KeepAlive :include="['HomeView']">
              <component :is="Component" />
            </KeepAlive>
          </Transition>
        </RouterView>
      </div>
    </main>
    <Footer v-if="!appStore.loading" />
    <Toaster rich-colors close-button position="top-center" />
  </Provider>
</template>
