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
