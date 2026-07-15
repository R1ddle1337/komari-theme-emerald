import { ref } from 'vue'

/**
 * 自适应画质分级。
 *
 * - high：全特效（桌面默认）
 * - medium：玻璃降半径、背景 30fps（移动端默认；桌面实测掉帧降到此档）
 * - low：静态高级模式——背景冻结成一帧、地球静止、进场动画去模糊。
 *   背景不变时合成器会缓存所有 backdrop-filter 结果，玻璃成本归零。
 *
 * 判级结果持久化到 localStorage，之后的访问秒判不再探测。
 * html 根元素带 perf-medium / perf-low 类供 CSS 分级（high 无类）。
 */
export type PerfTier = 'high' | 'medium' | 'low'

const STORAGE_KEY = 'emerald-perf-tier-v1'

function readStoredTier(): PerfTier | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'high' || value === 'medium' || value === 'low' ? value : null
  }
  catch {
    return null
  }
}

// 探测前的保守默认：桌面 high，移动端 medium，明显弱的设备直接 low
function defaultTier(): PerfTier {
  if (typeof window === 'undefined')
    return 'high'
  const nav = navigator as Navigator & { deviceMemory?: number }
  if ((nav.deviceMemory != null && nav.deviceMemory <= 2) || navigator.hardwareConcurrency <= 3)
    return 'low'
  return window.innerWidth < 768 ? 'medium' : 'high'
}

export const perfTier = ref<PerfTier>(readStoredTier() ?? defaultTier())

// 模块加载即同步根类，存档 low 的用户首帧就走降级样式
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('perf-medium', perfTier.value === 'medium')
  document.documentElement.classList.toggle('perf-low', perfTier.value === 'low')
}

function syncRootClass(tier: PerfTier): void {
  const root = document.documentElement
  root.classList.toggle('perf-medium', tier === 'medium')
  root.classList.toggle('perf-low', tier === 'low')
}

function applyTier(tier: PerfTier, persist: boolean): void {
  perfTier.value = tier
  syncRootClass(tier)
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, tier)
    }
    catch {
    }
  }
}

function measureFps(durationMs: number): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0
    const start = performance.now()
    function tick(now: number) {
      frames++
      if (now - start < durationMs)
        requestAnimationFrame(tick)
      else
        resolve(frames / ((now - start) / 1000))
    }
    requestAnimationFrame(tick)
  })
}

/**
 * App 就绪、进场动画结束后调用一次。
 * 已有存档则直接应用；否则跑 1 秒帧率探针，掉帧则降档并存档。
 */
export async function initPerfTier(): Promise<void> {
  const stored = readStoredTier()
  if (stored) {
    applyTier(stored, false)
    return
  }
  const base = defaultTier()
  applyTier(base, false)
  if (document.visibilityState !== 'visible') {
    // 后台标签页 rAF 被节流，测出来全是假掉帧，放弃本次探测
    return
  }
  const fps = await measureFps(1000)
  let result = base
  if (fps < 28)
    result = 'low'
  else if (fps < 48)
    result = base === 'high' ? 'medium' : 'low'
  applyTier(result, true)
}

/**
 * 滚动冻结：滚动中及结束后 idleMs 内挂起背景重绘，
 * 避免"滚动失效 + 动画失效"双重叠加。调用方在渲染循环里查询。
 */
export function createScrollFreeze(idleMs = 300): { isFrozen: () => boolean, dispose: () => void } {
  let frozenUntil = 0
  const onScroll = () => {
    frozenUntil = performance.now() + idleMs
  }
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  return {
    isFrozen: () => performance.now() < frozenUntil,
    dispose: () => document.removeEventListener('scroll', onScroll, { capture: true }),
  }
}
