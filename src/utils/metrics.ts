import { getSharedRpc, RpcError } from '@/utils/rpc'

export interface PingHistoryRecord {
  client: string
  task_id: number
  time: string
  value: number
  count?: number
  loss?: number
}

interface MetricSeries {
  entity_id: string
  metric_key: string
  tags?: Record<string, string>
  points?: { time: string, value: number | null, count?: number, tags?: Record<string, string> }[]
}

export async function getPingHistoryRecords(hours: number, signal?: AbortSignal): Promise<PingHistoryRecord[]> {
  const client = getSharedRpc().getClient()
  try {
    const result = await client.call<{ series?: MetricSeries[] }>('public:queryMetrics', {
      metric_keys: ['ping.latency_ms', 'ping.loss'],
      hours,
      max_points: 120,
      aggregation: 'avg',
    }, { signal })
    const records = new Map<string, PingHistoryRecord>()
    for (const series of result.series ?? []) {
      for (const point of series.points ?? []) {
        if (point.value === null)
          continue
        const taskId = Number(point.tags?.task_id ?? series.tags?.task_id)
        if (!Number.isInteger(taskId) || !series.entity_id)
          continue
        const key = `${series.entity_id}:${taskId}:${point.time}`
        const record = records.get(key) ?? { client: series.entity_id, task_id: taskId, time: point.time, value: -1 }
        if (series.metric_key === 'ping.loss') {
          record.loss = Math.min(1, Math.max(0, point.value))
          record.count = point.count ?? 1
        }
        else {
          record.value = point.value
        }
        records.set(key, record)
      }
    }
    return [...records.values()]
  }
  catch (error) {
    if (!(error instanceof RpcError) || error.code !== -32601)
      throw error
    const legacy = await client.call<{ records?: PingHistoryRecord[] }>('common:getRecords', { type: 'ping', hours, maxCount: 4000 }, { signal })
    return legacy.records ?? []
  }
}

export function pingSampleCount(record: PingHistoryRecord): number {
  return Math.max(1, record.count ?? 1)
}

export function pingLostCount(record: PingHistoryRecord): number {
  return pingSampleCount(record) * (record.loss ?? (record.value < 0 ? 1 : 0))
}

export function pingAverageLatency(records: PingHistoryRecord[]): number {
  let total = 0
  let samples = 0
  for (const record of records) {
    if (record.value < 0)
      continue
    const valid = pingSampleCount(record) - pingLostCount(record)
    total += record.value * valid
    samples += valid
  }
  return samples > 0 ? total / samples : 0
}
