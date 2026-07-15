<script setup lang="ts">
import PingBars from '@/components/PingBars.vue'
import { useNodePingDisplay } from '@/composables/useNodePingDisplay'

const props = defineProps<{
  uuid: string
  online: boolean
}>()

const {
  latencyRenderBars,
  lossRenderBars,
} = useNodePingDisplay(() => props.uuid)
</script>

<template>
  <div class="group flex flex-col gap-[1px] pr-4">
    <div class="h-1 opacity-80 transition-all hover:h-2.5 hover:opacity-100">
      <PingBars :bars="latencyRenderBars" />
    </div>
    <div class="h-1 opacity-80 transition-all hover:h-2.5 hover:opacity-100">
      <PingBars :bars="lossRenderBars" />
    </div>
  </div>
</template>
