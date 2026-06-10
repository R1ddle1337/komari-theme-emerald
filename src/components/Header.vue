<script setup lang="ts">
import type { ShaderType } from '@/stores/app'
import { Icon } from '@iconify/vue'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const appStore = useAppStore()

const isScrolled = inject<ReturnType<typeof ref<boolean>>>('isScrolled', ref(false))

const siteFavicon = ref('/favicon.ico')

// Shader选择器弹出状态
const showShaderMenu = ref(false)
const triggerRef = ref<HTMLElement>()
const menuRef = ref<HTMLElement>()

// 菜单定位
const menuPosition = ref({ top: '0px', right: '0px' })

function updateMenuPosition() {
  if (!triggerRef.value)
    return
  const rect = triggerRef.value.getBoundingClientRect()
  menuPosition.value = {
    top: `${rect.bottom + 8}px`,
    right: `${window.innerWidth - rect.right}px`,
  }
}

function toggleMenu() {
  showShaderMenu.value = !showShaderMenu.value
  if (showShaderMenu.value) {
    nextTick(updateMenuPosition)
  }
}

const shaderOptions: { label: string, value: ShaderType, icon: string }[] = [
  { label: '气泡', value: 'bubbles', icon: 'icon-park-outline:bubble' },
  { label: '流体', value: 'liquid', icon: 'icon-park-outline:water-level' },
  { label: '无', value: 'none', icon: 'icon-park-outline:close-one' },
]

function selectShader(value: ShaderType) {
  appStore.shaderType = value
  showShaderMenu.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (!showShaderMenu.value)
    return
  const target = e.target as HTMLElement
  // 如果点击的是菜单本体或触发按钮，不关闭
  if (target.closest('.shader-menu-container'))
    return
  if (target.closest('.shader-menu-dropdown'))
    return
  showShaderMenu.value = false
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside, true)
})

const actionButtons = computed(() => {
  const buttons = [
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

function handleButtonClick(action: string) {
  switch (action) {
    case 'toggleTheme':
      appStore.updateThemeMode()
      break
    case 'jumpToSetting':
      location.href = '/admin'
      break
  }
}

const sitename = computed(() => appStore.publicSettings?.sitename || 'Komari Monitor')
</script>

<template>
  <div
    class="transition-all duration-200 top-0 sticky z-10 border-b border-transparent"
    :class="isScrolled ? '!border-slate-500/10 backdrop-blur-xl backdrop-saturate-150' : 'bg-transparent'"
  >
    <div class="px-4 flex-between h-14 max-w-[1280px] mx-auto">
      <div class="flex items-center gap-3 cursor-pointer" @click="router.push('/')">
        <Avatar class="size-8">
          <AvatarImage :src="siteFavicon" :alt="sitename" />
          <AvatarFallback>{{ sitename.slice(0, 1) }}</AvatarFallback>
        </Avatar>
        <h3 class="m-0 text-lg font-semibold">
          {{ sitename }}
        </h3>
      </div>
      <TooltipProvider :delay-duration="200">
        <div class="flex items-center gap-2">
          <!-- Shader背景选择器 -->
          <div ref="triggerRef" class="relative shader-menu-container">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon-sm" @click.stop="toggleMenu">
                  <Icon icon="icon-park-outline:pic" :width="18" :height="18" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>背景效果</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip v-for="button in actionButtons" :key="button.action">
            <TooltipTrigger as-child>
              <Button variant="ghost" size="icon-sm" @click="handleButtonClick(button.action)">
                <Icon :icon="button.icon" :width="18" :height="18" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ button.title }}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  </div>

  <!-- 菜单 Teleport 到 body，脱离 Header stacking context -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-150 ease-out"
      enter-from-class="opacity-0 scale-95 -translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-100 ease-in"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 -translate-y-1"
    >
      <div
        v-if="showShaderMenu"
        ref="menuRef"
        class="shader-menu-dropdown fixed w-32 rounded-lg border border-border bg-popover/90 backdrop-blur-xl p-1 shadow-lg z-[9999]"
        :style="{ top: menuPosition.top, right: menuPosition.right }"
      >
        <button
          v-for="opt in shaderOptions"
          :key="opt.value"
          type="button"
          class="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-accent/50 cursor-pointer"
          :class="appStore.shaderType === opt.value ? 'text-foreground font-medium bg-accent/30' : 'text-muted-foreground'"
          @click.stop="selectShader(opt.value)"
        >
          <Icon :icon="opt.icon" :width="16" :height="16" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
