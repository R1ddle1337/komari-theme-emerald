import type { NodeData } from '@/stores/nodes'

export const NODE_HEALTH_FILTERS = [
  { key: 'all', label: '全部状态', hint: '显示当前分组和搜索下的全部节点' },
  { key: 'online', label: '在线', hint: '仅显示在线节点' },
  { key: 'offline', label: '离线', hint: '仅显示离线节点' },
  { key: 'expiring', label: '即将到期', hint: '未来 7 天内到期的节点' },
  { key: 'load', label: '高占用', hint: '在线节点的 CPU 或内存使用率达到 90%' },
  { key: 'traffic', label: '流量告急', hint: '流量使用已达到配置限额的 90%' },
] as const

export type NodeHealthFilter = typeof NODE_HEALTH_FILTERS[number]['key']

export function nodeTrafficUsed(node: NodeData): number {
  const up = node.net_total_up || 0
  const down = node.net_total_down || 0
  switch (node.traffic_limit_type) {
    case 'up': return up
    case 'down': return down
    case 'min': return Math.min(up, down)
    case 'max': return Math.max(up, down)
    default: return up + down
  }
}

export function matchesNodeHealth(node: NodeData, filter: NodeHealthFilter, now: number): boolean {
  switch (filter) {
    case 'online': return node.online
    case 'offline': return !node.online
    case 'expiring': {
      const expiry = Date.parse(node.expired_at)
      return expiry >= now && expiry <= now + 7 * 86400000
    }
    case 'load': return node.online && (node.cpu >= 90 || (node.mem_total > 0 && node.ram / node.mem_total >= 0.9))
    case 'traffic': return node.traffic_limit > 0 && nodeTrafficUsed(node) / node.traffic_limit >= 0.9
    default: return true
  }
}
