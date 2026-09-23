// Vue escapes attributes but does not validate URL schemes. Markdown content
// must never turn javascript:, data: or control-character variants into links.
export function contentUrl(value: string, image = false): string | undefined {
  const trimmed = value.trim()
  try {
    const url = new URL(trimmed, 'https://komari.invalid')
    if (url.protocol === 'https:' || url.protocol === 'http:' || (!image && url.protocol === 'mailto:'))
      return trimmed
  }
  catch {
  }
  return undefined
}
