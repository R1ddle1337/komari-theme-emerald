import { addCollection } from '@iconify/vue'
import icons from 'virtual:emerald-icons'

// Register the build-time subset before mounting. Custom icons may still use
// Iconify's fallback, but the theme's own icons need no CDN round trip.
export async function setupIconify(): Promise<void> {
  icons.forEach(collection => addCollection(collection))
}
