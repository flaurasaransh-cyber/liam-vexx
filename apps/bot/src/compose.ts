import sharp from 'sharp'
import type { AvatarSpot } from '@vexx/shared'

// Draws a new member's profile picture onto a welcome banner: a round photo with an orange ring and a soft dark
// halo, sized to the banner's height. "left" and "right" centre it in that third of the banner; "center" puts it
// near the top middle (centred banners keep their text lower down for this).
export async function bannerWithAvatar(banner: Buffer, avatar: Buffer, spot: AvatarSpot, ring = '#FF5A1F'): Promise<Buffer> {
  if (spot === 'none') return banner
  const meta = await sharp(banner).metadata()
  const w = meta.width ?? 1600
  const h = meta.height ?? 600
  const size = Math.round(h * (spot === 'center' ? 0.42 : 0.6))
  const border = Math.max(6, Math.round(size * 0.035))
  const outer = size + border * 2
  const halo = Math.round(outer * 1.35)

  const cx = spot === 'left' ? Math.round(w * 0.27) : spot === 'right' ? Math.round(w * 0.73) : Math.round(w / 2)
  // kept far enough from the edges that the halo never runs off the banner
  const cy = spot === 'center' ? Math.max(Math.round(halo / 2) + 4, Math.round(h * 0.27)) : Math.round(h / 2)

  const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`)
  const photo = await sharp(avatar)
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: circle, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const ringSvg = Buffer.from(
    `<svg width="${halo}" height="${halo}">
      <defs><radialGradient id="g"><stop offset="55%" stop-color="#000" stop-opacity=".55"/><stop offset="100%" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
      <circle cx="${halo / 2}" cy="${halo / 2}" r="${halo / 2}" fill="url(#g)"/>
      <circle cx="${halo / 2}" cy="${halo / 2}" r="${outer / 2}" fill="${ring}"/>
    </svg>`,
  )

  return sharp(banner)
    .composite([
      { input: ringSvg, left: Math.round(cx - halo / 2), top: Math.round(cy - halo / 2) },
      { input: photo, left: Math.round(cx - size / 2), top: Math.round(cy - size / 2) },
    ])
    .png()
    .toBuffer()
}
