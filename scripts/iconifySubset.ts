import type { Plugin } from 'vite'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const SOURCE_FILE = /\.(?:vue|ts)$/
const ICON_NAME = /['"`]([a-z0-9-]+):([a-z0-9-]+)['"`]/g

// Collections remain build-time data; the browser receives only used icons.
export function iconifySubset(): Plugin {
  const virtualId = 'virtual:emerald-icons'
  const resolvedId = `\0${virtualId}`
  const require = createRequire(import.meta.url)
  const collectionsDir = join(dirname(require.resolve('@iconify/json/package.json')), 'json')
  let root = ''
  return {
    name: 'emerald-icon-subset',
    configResolved(config) { root = config.root },
    resolveId(id) {
      if (id === virtualId)
        return resolvedId
    },
    load(id) {
      if (id !== resolvedId)
        return
      const names = new Map<string, Set<string>>()
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name)
          if (entry.isDirectory()) {
            walk(path)
          }
          else if (SOURCE_FILE.test(entry.name)) {
            this.addWatchFile(path)
            const source = readFileSync(path, 'utf8')
            for (const match of source.matchAll(ICON_NAME)) {
              const [, prefix, name] = match
              if (!existsSync(join(collectionsDir, `${prefix}.json`)))
                continue
              if (!names.has(prefix))
                names.set(prefix, new Set())
              names.get(prefix)!.add(name!)
            }
          }
        }
      }
      walk(join(root, 'src'))
      const subsets = []
      for (const [prefix, icons] of names) {
        const collection = JSON.parse(readFileSync(join(collectionsDir, `${prefix}.json`), 'utf8'))
        const subset = { prefix, width: collection.width, height: collection.height, icons: {} as Record<string, unknown>, aliases: {} as Record<string, unknown> }
        const add = (name: string) => {
          if (subset.icons[name] || subset.aliases[name])
            return
          if (collection.icons[name]) {
            subset.icons[name] = collection.icons[name]
          }
          else if (collection.aliases?.[name]) {
            subset.aliases[name] = collection.aliases[name]
            add(collection.aliases[name].parent)
          }
          else {
            throw new Error(`Unknown theme icon: ${prefix}:${name}`)
          }
        }
        icons.forEach(add)
        subsets.push(subset)
      }
      return `export default ${JSON.stringify(subsets)}`
    },
  }
}
