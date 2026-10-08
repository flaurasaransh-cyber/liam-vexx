import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { panelSchema, type PanelState } from '@vexx/shared'
import { env } from './env.js'
import { clearFailures, issueToken, passwordMatches, recordFailure, requireAdmin, tooManyAttempts } from './auth.js'
import { client, messageUrl, publish, sendTestWelcome, textChannels } from './discord.js'
import { current, image, imageUrl, isLoaded, load, rosterImageUrl, save, type Image } from './store.js'
const imageBytes = (name: string) => image(name)?.data.length ?? null

export const app = express()
app.set('trust proxy', 1)
app.use(cors({ origin: env.adminOrigins.length ? env.adminOrigins : false, allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(express.json({ limit: '12mb' }))

const message = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong.')

function state(): PanelState {
  const saved = current()
  const user = client.user
  return {
    panel: saved.panel,
    messageId: saved.messageId,
    messageUrl: messageUrl(),
    publishedAt: saved.publishedAt,
    updatedAt: saved.updatedAt,
    rosterImageUrl: rosterImageUrl(),
    banners: saved.panel.welcome.banners.map((name) => ({ name, url: imageUrl(name) })),
    bot: {
      name: user?.username ?? 'VEXX',
      avatarUrl: user?.displayAvatarURL({ size: 128 }) ?? null,
      online: client.isReady(),
      guilds: client.guilds.cache.map((g) => ({ id: g.id, name: g.name })),
    },
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, discord: client.isReady() })
})

app.post('/api/login', (req, res) => {
  const ip = req.ip ?? 'unknown'
  if (tooManyAttempts(ip)) {
    res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes.' })
    return
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!passwordMatches(password)) {
    recordFailure(ip)
    res.status(401).json({ error: 'That password is not right.' })
    return
  }
  clearFailures(ip)
  res.json(issueToken())
})

app.use('/api', requireAdmin)

app.use('/api', async (_req, res, next) => {
  if (!client.isReady()) {
    res.status(503).json({ error: 'The bot is still connecting to Discord. Try again in a few seconds.' })
    return
  }
  if (!isLoaded()) await load(client).catch(() => {})
  next()
})

app.get('/api/state', (_req, res) => {
  res.json(state())
})

app.put('/api/panel', async (req, res) => {
  const parsed = panelSchema.safeParse(req.body?.panel)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    res.status(400).json({ error: `${first.path.join(' › ')}: ${first.message}` })
    return
  }
  try {
    // images are owned by the upload endpoints; the form may only reorder the banners it already has
    const was = current().panel
    const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((n) => b.includes(n))
    const banners = sameSet(parsed.data.welcome.banners, was.welcome.banners) ? parsed.data.welcome.banners : was.welcome.banners
    const panel = {
      ...parsed.data,
      roster: { ...parsed.data.roster, imageName: was.roster.imageName },
      welcome: { ...parsed.data.welcome, banners },
    }
    await save(client, { panel })
    res.json(state())
  } catch (err) {
    res.status(500).json({ error: message(err) })
  }
})

const imageSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  data: z.string().min(1),
})
const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as const

// Every image rides on one Discord message, and Discord caps a bot upload at 10 MB, so the images together stay
// under that. One image may be up to 4 MB.
const MAX_ONE = 4 * 1024 * 1024
const MAX_ALL = 9.5 * 1024 * 1024
function sizeProblem(data: Buffer, replacing: string | null): string | null {
  if (data.length > MAX_ONE) return 'That image is over 4 MB. Save it smaller (a JPG or WEBP around 1600 px wide is plenty).'
  const panel = current().panel
  const names = [panel.roster.imageName, ...panel.welcome.banners].filter((n): n is string => Boolean(n) && n !== replacing)
  const used = names.reduce((sum, n) => sum + (imageBytes(n) ?? 0), 0)
  if (used + data.length > MAX_ALL) return "The images together would go over Discord's 10 MB limit. Remove a banner or use smaller files."
  return null
}

app.post('/api/roster-image', async (req, res) => {
  const parsed = imageSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Send a PNG, JPG, WEBP or GIF image.' })
    return
  }
  const data = Buffer.from(parsed.data.data, 'base64')
  const tooBig = sizeProblem(data, current().panel.roster.imageName)
  if (tooBig) {
    res.status(413).json({ error: tooBig })
    return
  }
  try {
    const was = current().panel
    const img: Image = { name: `roster-${Date.now()}.${extension[parsed.data.type]}`, data }
    await save(client, { panel: { ...was, roster: { ...was.roster, imageName: img.name } } }, { set: [img] })
    res.json(state())
  } catch (err) {
    res.status(500).json({ error: message(err) })
  }
})

app.delete('/api/roster-image', async (_req, res) => {
  try {
    const was = current().panel
    await save(client, { panel: { ...was, roster: { ...was.roster, imageName: null } } })
    res.json(state())
  } catch (err) {
    res.status(500).json({ error: message(err) })
  }
})

app.post('/api/publish', async (_req, res) => {
  try {
    const result = await publish()
    res.json({ ...state(), result })
  } catch (err) {
    res.status(500).json({ error: message(err) })
  }
})

app.get('/api/channels', async (_req, res) => {
  try {
    res.json({ channels: await textChannels() })
  } catch (err) {
    res.status(500).json({ error: message(err) })
  }
})

app.post('/api/welcome/banners', async (req, res) => {
  const parsed = imageSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Send a PNG, JPG, WEBP or GIF image.' })
    return
  }
  const was = current().panel
  if (was.welcome.banners.length >= 8) {
    res.status(400).json({ error: 'There are already 8 banners. Remove one first.' })
    return
  }
  const data = Buffer.from(parsed.data.data, 'base64')
  const tooBig = sizeProblem(data, null)
  if (tooBig) {
    res.status(413).json({ error: tooBig })
    return
  }
  try {
    const img: Image = { name: `banner-${Date.now()}.${extension[parsed.data.type]}`, data }
    await save(client, { panel: { ...was, welcome: { ...was.welcome, banners: [...was.welcome.banners, img.name] } } }, { set: [img] })
    res.json(state())
  } catch (err) {
    res.status(500).json({ error: message(err) })
  }
})

app.delete('/api/welcome/banners/:name', async (req, res) => {
  const was = current().panel
  if (!was.welcome.banners.includes(req.params.name)) {
    res.status(404).json({ error: 'That banner is already gone.' })
    return
  }
  try {
    await save(client, { panel: { ...was, welcome: { ...was.welcome, banners: was.welcome.banners.filter((n) => n !== req.params.name) } } })
    res.json(state())
  } catch (err) {
    res.status(500).json({ error: message(err) })
  }
})

app.post('/api/welcome/test', async (_req, res) => {
  try {
    res.json(await sendTestWelcome())
  } catch (err) {
    res.status(500).json({ error: message(err) })
  }
})
