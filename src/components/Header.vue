<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()

const siteFavicon = ref('/favicon.ico')

const actionButtons = computed(() => {
  const buttons = [
    {
      title: appStore.offlineNotifyEnabled ? '掉线通知：已开启' : '掉线通知：已关闭',
      icon: appStore.offlineNotifyEnabled ? 'icon-park-outline:remind' : 'icon-park-outline:close-remind',
      action: 'toggleOfflineNotify',
    },
    {
      title: appStore.themeMode === 'auto' ? '自动主题' : appStore.themeMode === 'light' ? '浅色主题' : '深色主题',
      icon: appStore.themeMode === 'auto' ? 'icon-park-outline:dark-mode' : appStore.themeMode === 'light' ? 'icon-park-outline:sun-one' : 'icon-park-outline:moon',
      action: 'toggleTheme',
    },
  ]

  if (appStore.isLoggedIn || !appStore.hideAdminEntryWhenLoggedOut) {
    buttons.push({
      title: '后台管理',
      icon: 'icon-park-outline:setting',
      action: 'jumpToSetting',
    })
  }
  return buttons
})

async function toggleOfflineNotify() {
  if (appStore.offlineNotifyEnabled) {
    appStore.offlineNotifyEnabled = false
    window.$message?.info('已关闭掉线通知')
    return
  }
  if (typeof Notification === 'undefined') {
    window.$message?.error('当前浏览器不支持桌面通知')
    return
  }
  let permission = Notification.permission
  if (permission === 'default')
    permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    window.$message?.warning('通知权限被拒绝，请在浏览器站点设置中允许通知')
    return
  }
  appStore.offlineNotifyEnabled = true
  window.$message?.success('已开启掉线通知：节点离线/恢复时会收到桌面提醒')
}

function handleButtonClick(action: string) {
  switch (action) {
    case 'toggleTheme':
      appStore.updateThemeMode()
      break
    case 'toggleOfflineNotify':
      toggleOfflineNotify()
      break
    case 'jumpToSetting':
      location.href = appStore.isLoggedIn ? '/admin/dashboard' : '/admin/login'
      break
  }
}

const sitename = computed(() => appStore.publicSettings?.sitename || 'Komari Monitor')
</script>

<template>
  <div
    class="sticky top-0 z-30 border-b border-border bg-card"
  >
    <div class="px-4 flex-between h-16 max-w-[1440px] mx-auto">
      <div role="link" tabindex="0" aria-label="返回首页" class="flex items-center gap-3 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-emerald-500" @click="router.push('/')" @keydown.enter="router.push('/')">
        <Avatar class="size-8">
          <AvatarImage :src="siteFavicon" :alt="sitename" />
          <AvatarFallback>{{ sitename.slice(0, 1) }}</AvatarFallback>
        </Avatar>
        <h3 class="m-0 text-lg font-semibold tracking-tight">
          {{ sitename }}
        </h3>
      </div>
      <TooltipProvider :delay-duration="200">
        <div class="flex items-center gap-2">
          <Tooltip v-for="button in actionButtons" :key="button.action">
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-sm" :aria-label="button.title" @click="handleButtonClick(button.action)">
                <Icon :icon="button.icon" :width="18" :height="18" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ button.title }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  </div>
</template>
