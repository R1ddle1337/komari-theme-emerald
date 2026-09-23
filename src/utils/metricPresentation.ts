const HTML_ESCAPE = /[&<>"']/g
const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }

// ECharts HTML formatters bypass Vue's automatic text escaping.
export function escapeChartText(value: unknown): string {
  return String(value ?? '').replace(HTML_ESCAPE, char => HTML_ENTITIES[char]!)
}

export interface MetricSource {
  downsampled?: boolean
  interval_seconds?: number
}

export function metricSourceLabel(series: MetricSource[]): string {
  if (!series.length)
    return ''
  if (series.every(item => item.downsampled === undefined))
    return '采样来源未标注；缺失数据保留为空'
  if (!series.some(item => item.downsampled))
    return '原始采样；缺失数据保留为空'
  const step = Math.max(0, ...series.map(item => Number.isFinite(item.interval_seconds) ? item.interval_seconds ?? 0 : 0))
  return `平均值聚合${step > 0 ? ` · ${Math.round(step)} 秒/点` : ''}；缺失数据保留为空`
}
