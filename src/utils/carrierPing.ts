export const CARRIERS = [
  { id: 'telecom', name: '电信' },
  { id: 'unicom', name: '联通' },
  { id: 'mobile', name: '移动' },
] as const

export type CarrierId = typeof CARRIERS[number]['id']
export interface PingTask { id: number, name: string, weight?: number }
export interface CarrierTask extends PingTask { carrier: CarrierId, region: string }
export interface PingSummary {
  entity_id: string
  task_id: string
  total: number
  valid: number
  loss: number
  avg?: number
  loss_approximate?: boolean
}
export interface CarrierReading { latency: number | null, loss: number | null, samples: number, targets: number }

const CARRIER_PATTERNS: [CarrierId, RegExp][] = [
  ['telecom', /(?:中国|中國)?(?:电信|電信)|china\s*telecom|\bCT(?:CC)?\b/i],
  ['unicom', /(?:中国|中國)?(?:联通|聯通)|china\s*unicom|\bCU(?:CC)?\b/i],
  ['mobile', /(?:中国|中國)?(?:移动|移動)|china\s*mobile|\bCM(?:CC)?\b/i],
]

const PROBE_KIND = /\b(?:TCP|ICMP|PING|HTTP|HTTPS)\b/gi
const REGION_SEPARATORS = /^[\s·|/()（）_-]+|[\s·|/()（）_-]+$/g

export function classifyCarrierTasks(tasks: PingTask[]): CarrierTask[] {
  return [...tasks].sort((a, b) => (a.weight ?? 0) - (b.weight ?? 0) || a.id - b.id).flatMap((task) => {
    const match = CARRIER_PATTERNS.find(([, pattern]) => pattern.test(task.name))
    if (!match)
      return []
    const [carrier, pattern] = match
    const region = task.name.replace(pattern, '').replace(PROBE_KIND, '').replace(REGION_SEPARATORS, '').trim() || '默认'
    return [{ ...task, carrier, region }]
  })
}

// Average successful samples only, within one region and carrier. Failed
// probes still contribute to loss; unavailable measurements remain null.
export function carrierReading(tasks: CarrierTask[], summaries: PingSummary[], region: string, carrier: CarrierId): CarrierReading {
  const ids = new Set(tasks.filter(task => task.region === region && task.carrier === carrier).map(task => String(task.id)))
  const values = summaries.filter(stat => ids.has(stat.task_id) && !stat.loss_approximate && stat.total > 0)
  const samples = values.reduce((sum, stat) => sum + stat.total, 0)
  const valid = values.filter(stat => stat.valid > 0 && typeof stat.avg === 'number' && Number.isFinite(stat.avg))
  const success = valid.reduce((sum, stat) => sum + stat.valid, 0)
  return {
    latency: success ? valid.reduce((sum, stat) => sum + stat.avg! * stat.valid, 0) / success : null,
    loss: samples ? values.reduce((sum, stat) => sum + stat.loss * stat.total, 0) / samples : null,
    samples,
    targets: ids.size,
  }
}

export interface PingHistorySeries {
  entity_id: string
  metric_key: string
  tags?: Record<string, string>
  points: { time: string, value: number | null, count: number }[]
}
export interface CarrierTrendPoint { time: number, latency: number | null, loss: number | null }
interface TaskTrendPoint extends CarrierTrendPoint { success: number, samples: number }
export type TaskTrends = Map<string, TaskTrendPoint[]>
export const TREND_MINUTES = 30
const MINUTE = 60_000

// Build one index per response. Pair latency and loss buckets before combining
// tasks: failed probes contribute -1 to latency, never a fast/zero measurement.
export function indexPingHistory(series: PingHistorySeries[]): Map<string, TaskTrends> {
  interface Bucket { latencySum: number, latencyCount: number, lossSum: number, lossCount: number }
  const entities = new Map<string, Map<string, Map<number, Bucket>>>()
  for (const item of series) {
    const task = item.tags?.task_id
    if (!task || !['ping.latency_ms', 'ping.loss'].includes(item.metric_key))
      continue
    const tasks = entities.get(item.entity_id) ?? new Map<string, Map<number, Bucket>>()
    entities.set(item.entity_id, tasks)
    const buckets = tasks.get(task) ?? new Map<number, Bucket>()
    tasks.set(task, buckets)
    for (const point of item.points) {
      const time = Math.floor(Date.parse(point.time) / MINUTE) * MINUTE
      if (!Number.isFinite(time) || point.value === null || !Number.isFinite(point.value) || point.count <= 0)
        continue
      if (item.metric_key === 'ping.latency_ms' ? point.value < -1 : point.value < 0 || point.value > 1)
        continue
      const bucket = buckets.get(time) ?? { latencySum: 0, latencyCount: 0, lossSum: 0, lossCount: 0 }
      buckets.set(time, bucket)
      if (item.metric_key === 'ping.latency_ms') {
        bucket.latencySum += point.value * point.count
        bucket.latencyCount += point.count
      }
      else {
        bucket.lossSum += point.value * point.count
        bucket.lossCount += point.count
      }
    }
  }
  const result = new Map<string, TaskTrends>()
  for (const [entity, tasks] of entities) {
    const trends: TaskTrends = new Map()
    for (const [task, buckets] of tasks) {
      const points = [...buckets].sort(([a], [b]) => a - b).map(([time, b]) => {
        const paired = b.latencyCount > 0 && b.latencyCount === b.lossCount
        const lost = Math.round(b.lossSum)
        const success = paired ? b.latencyCount - lost : 0
        return {
          time,
          latency: success > 0 ? Math.max(0, (b.latencySum + lost) / success) : null,
          loss: b.lossCount ? b.lossSum / b.lossCount * 100 : null,
          success,
          samples: b.lossCount,
        }
      })
      trends.set(task, points)
    }
    result.set(entity, trends)
  }
  return result
}

export function carrierTrend(tasks: CarrierTask[], trends: TaskTrends | undefined, region: string, carrier: CarrierId, end: number): CarrierTrendPoint[] {
  const lastMinute = Math.floor(end / MINUTE) * MINUTE
  const points = Array.from({ length: TREND_MINUTES }, (_, i) => ({ time: lastMinute - (TREND_MINUTES - 1 - i) * MINUTE, sum: 0, success: 0, lost: 0, samples: 0 }))
  const start = points[0]!.time
  for (const task of tasks.filter(task => task.region === region && task.carrier === carrier)) {
    for (const reading of trends?.get(String(task.id)) ?? []) {
      const index = Math.round((reading.time - start) / MINUTE)
      const bucket = points[index]
      if (!bucket)
        continue
      const p = reading
      if (p.latency !== null && p.success > 0) {
        bucket.sum += p.latency * p.success
        bucket.success += p.success
      }
      if (p.loss !== null && p.samples > 0) {
        bucket.lost += p.loss * p.samples
        bucket.samples += p.samples
      }
    }
  }
  return points.map(p => ({ time: p.time, latency: p.success ? p.sum / p.success : null, loss: p.samples ? p.lost / p.samples : null }))
}
