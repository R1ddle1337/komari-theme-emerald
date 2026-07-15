import type { NodeData } from '@/stores/nodes'

export interface NodeSortOption {
  key: string
  label: string
}

// 卡片视图排序 chips 用的排序项（列表视图的表头/chips 由 NodeList 自己的列配置驱动）
export const NODE_SORT_OPTIONS: NodeSortOption[] = [
  { key: 'name', label: '节点' },
  { key: 'uptime', label: '运行时间' },
  { key: 'cpu', label: 'CPU' },
  { key: 'mem', label: '内存' },
  { key: 'disk', label: '硬盘' },
  { key: 'traffic', label: '流量' },
  { key: 'rate', label: '速率' },
  { key: 'expired', label: '到期' },
]

// 到期排序值：毫秒时间戳；未设置/非法/零值时间（Komari 未配置时为 0001-01-01）/长期视为无到期，恒排最后
const EXPIRE_RANGE_MS = 36500 * 86400000
function getExpirySortValue(node: NodeData): number | null {
  if (!node.expired_at)
    return null
  const ms = new Date(node.expired_at).getTime()
  if (!Number.isFinite(ms))
    return null
  const now = Date.now()
  if (ms < now - EXPIRE_RANGE_MS || ms > now + EXPIRE_RANGE_MS)
    return null
  return ms
}

// 离线节点固定排在最后（组内保持原有顺序），任何排序/置顶之后最外层套用
export function applyOfflineLast(nodes: NodeData[]): NodeData[] {
  const online: NodeData[] = []
  const offline: NodeData[] = []
  for (const node of nodes)
    (node.online ? online : offline).push(node)
  return offline.length && online.length ? [...online, ...offline] : nodes
}

// 收藏的节点固定排在最前（组内保持原有顺序）
export function applyPinnedFirst(nodes: NodeData[], pinned: string[]): NodeData[] {
  if (!pinned.length)
    return nodes
  const pinnedSet = new Set(pinned)
  const front: NodeData[] = []
  const rest: NodeData[] = []
  for (const node of nodes)
    (pinnedSet.has(node.uuid) ? front : rest).push(node)
  return front.length ? [...front, ...rest] : nodes
}

export function getTrafficUsed(node: NodeData): number {
  const { net_total_up = 0, net_total_down = 0, traffic_limit_type } = node
  switch (traffic_limit_type) {
    case 'up': return net_total_up
    case 'down': return net_total_down
    case 'min': return Math.min(net_total_up, net_total_down)
    case 'max': return Math.max(net_total_up, net_total_down)
    case 'sum':
    default: return net_total_up + net_total_down
  }
}

export function sortNodes(nodes: NodeData[], key: string, dir: 1 | -1): NodeData[] {
  const sorted = [...nodes]
  if (!key)
    return sorted
  return sorted.sort((a, b) => {
    switch (key) {
      case 'status': return dir * ((a.online ? 1 : 0) - (b.online ? 1 : 0))
      case 'region': {
        const va = (a.region || '').toLowerCase()
        const vb = (b.region || '').toLowerCase()
        return dir * (va < vb ? -1 : va > vb ? 1 : 0)
      }
      case 'name': {
        const va = (a.name || '').toLowerCase()
        const vb = (b.name || '').toLowerCase()
        return dir * (va < vb ? -1 : va > vb ? 1 : 0)
      }
      case 'uptime': return dir * ((a.uptime ?? 0) - (b.uptime ?? 0))
      case 'os': {
        const va = (a.os || '').toLowerCase()
        const vb = (b.os || '').toLowerCase()
        return dir * (va < vb ? -1 : va > vb ? 1 : 0)
      }
      case 'cpu': return dir * ((a.cpu ?? 0) - (b.cpu ?? 0))
      case 'mem': return dir * ((a.ram ?? 0) / (a.mem_total || 1) - (b.ram ?? 0) / (b.mem_total || 1))
      case 'disk': return dir * ((a.disk ?? 0) / (a.disk_total || 1) - (b.disk ?? 0) / (b.disk_total || 1))
      case 'traffic':
        return dir * (getTrafficUsed(a) - getTrafficUsed(b))
      case 'expired': {
        const va = getExpirySortValue(a)
        const vb = getExpirySortValue(b)
        // 无到期的节点不参与正反向，恒排最后
        if (va === null || vb === null)
          return va === vb ? 0 : va === null ? 1 : -1
        return dir * (va - vb)
      }
      case 'rate':
        return dir * (((a.net_out ?? 0) + (a.net_in ?? 0)) - ((b.net_out ?? 0) + (b.net_in ?? 0)))
      default: return 0
    }
  })
}
