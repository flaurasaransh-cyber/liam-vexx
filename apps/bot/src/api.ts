import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { panelSchema, type PanelState } from '@vexx/shared'
import { env } from './env.js'
import { clearFailures, issueToken, passwordMatches, recordFailure, requireAdmin, tooManyAttempts } from './auth.js'
import { client, messageUrl, publish } from './discord.js'
import { current, isLoaded, load, rosterImageUrl, save } from './store.js'

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
    // the image name is owned by the upload endpoint, never by the form
    const panel = { ...parsed.data, roster: { ...parsed.data.roster, imageName: current().panel.roster.imageName } }
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

app.post('/api/roster-image', async (req, res) => {
  const parsed = imageSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Send a PNG, JPG, WEBP or GIF image.' })
    return
  }
  const data = Buffer.from(parsed.data.data, 'base64')
  if (data.length > 8 * 1024 * 1024) {
    res.status(413).json({ error: 'The image is over 8 MB. Use a smaller one.' })
    return
  }
  try {
    await save(client, {}, { name: `roster.${extension[parsed.data.type]}`, data })
    res.json(state())
  } catch (err) {
    res.status(500).json({ error: message(err) })
  }
})

app.delete('/api/roster-image', async (_req, res) => {
  try {
    await save(client, {}, null)
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
