import {
  AttachmentBuilder,
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type Message,
  type TextChannel,
} from 'discord.js'
import { defaultPanel, panelSchema, type Panel } from '@vexx/shared'
import { env } from './env.js'

// The bot keeps its settings in Discord: one message in a private channel, carrying config.json and every image
// (roster picture, welcome banners) as attachments. Saving posts a fresh message and removes the old one, so the
// newest message is always the truth. No database, nothing else to host.

const CONFIG_FILE = 'vexx-config.json'
const CONFIG_CHANNEL_NAME = 'vexx-bot-config'

export type Saved = {
  panel: Panel
  messageId: string | null
  // the channel the published panel sits in (older saves did not record it: it was the panel channel)
  messageChannelId: string | null
  publishedAt: string | null
  updatedAt: string | null
}

export type Image = { name: string; data: Buffer }
export type ImageChanges = { set?: Image[]; remove?: string[] }

let saved: Saved = { panel: defaultPanel, messageId: null, messageChannelId: null, publishedAt: null, updatedAt: null }
const images = new Map<string, Buffer>()
const urls = new Map<string, string>()
let configChannel: TextChannel | null = null
let loaded = false
// saves run one at a time, so two quick edits cannot leave two config messages behind
let queue: Promise<unknown> = Promise.resolve()

export const current = () => saved
export const isLoaded = () => loaded
export const imageUrl = (name: string | null) => (name ? (urls.get(name) ?? null) : null)
export const image = (name: string | null): Image | null => {
  const data = name ? images.get(name) : undefined
  return name && data ? { name, data } : null
}
export const rosterImage = () => image(saved.panel.roster.imageName)
export const rosterImageUrl = () => imageUrl(saved.panel.roster.imageName)

// the images the saved settings point at; anything else is dropped on the next save
const referenced = (panel: Panel) => new Set([panel.roster.imageName, ...panel.welcome.banners].filter((n): n is string => Boolean(n)))

async function panelGuild(client: Client, channelId: string): Promise<Guild> {
  const channel = await client.channels.fetch(channelId).catch(() => null)
  if (!channel || !('guild' in channel) || !channel.guild) {
    throw new Error(`The bot cannot see channel ${channelId}. Invite the bot to that server first.`)
  }
  return channel.guild
}

export async function serverOf(client: Client): Promise<Guild> {
  return panelGuild(client, saved.panel.channelId)
}

async function findConfigChannel(client: Client, channelId: string): Promise<TextChannel> {
  if (configChannel) return configChannel
  if (env.configChannelId) {
    const ch = await client.channels.fetch(env.configChannelId).catch(() => null)
    if (!ch || ch.type !== ChannelType.GuildText) throw new Error(`CONFIG_CHANNEL_ID ${env.configChannelId} is not a text channel the bot can see.`)
    configChannel = ch
    return ch
  }
  const guild = await panelGuild(client, channelId)
  const channels = await guild.channels.fetch()
  const found = channels.find((c) => c?.type === ChannelType.GuildText && c.name === CONFIG_CHANNEL_NAME)
  if (found && found.type === ChannelType.GuildText) {
    configChannel = found
    return found
  }
  const me = guild.members.me ?? (await guild.members.fetchMe())
  configChannel = await guild.channels.create({
    name: CONFIG_CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: 'Settings for the VEXX bot. Do not delete messages here; the newest one is what the bot uses.',
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] },
    ],
  })
  return configChannel
}

function latestConfigMessage(messages: Iterable<Message>, botId: string): Message | null {
  let best: Message | null = null
  for (const m of messages) {
    if (m.author.id !== botId || !m.attachments.some((a) => a.name === CONFIG_FILE)) continue
    if (!best || m.createdTimestamp > best.createdTimestamp) best = m
  }
  return best
}

// Reads the newest saved config and its images from Discord. Safe to call again; it refreshes the cache.
export async function load(client: Client): Promise<void> {
  const channel = await findConfigChannel(client, saved.panel.channelId)
  const messages = await channel.messages.fetch({ limit: 50 })
  const message = latestConfigMessage(messages.values(), client.user!.id)
  if (!message) {
    loaded = true
    return
  }
  const file = message.attachments.find((a) => a.name === CONFIG_FILE)!
  const raw = await (await fetch(file.url)).json()
  const panel = panelSchema.safeParse(raw.panel)
  saved = {
    panel: panel.success ? panel.data : defaultPanel,
    messageId: typeof raw.messageId === 'string' ? raw.messageId : null,
    messageChannelId: typeof raw.messageChannelId === 'string' ? raw.messageChannelId : panel.success ? panel.data.channelId : null,
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  }
  images.clear()
  urls.clear()
  const wanted = referenced(saved.panel)
  for (const a of message.attachments.values()) {
    if (!wanted.has(a.name)) continue
    images.set(a.name, Buffer.from(await (await fetch(a.url)).arrayBuffer()))
    urls.set(a.name, a.url)
  }
  // a referenced image that is missing from the message is forgotten, so nothing points at a file that is gone
  saved.panel = {
    ...saved.panel,
    roster: { ...saved.panel.roster, imageName: saved.panel.roster.imageName && images.has(saved.panel.roster.imageName) ? saved.panel.roster.imageName : null },
    welcome: { ...saved.panel.welcome, banners: saved.panel.welcome.banners.filter((n) => images.has(n)) },
  }
  loaded = true
}

// Writes the config and its images as a new message, then removes older config messages.
export function save(client: Client, next: Partial<Saved>, changes: ImageChanges = {}): Promise<Saved> {
  const run = queue.then(async () => {
    for (const name of changes.remove ?? []) images.delete(name)
    for (const img of changes.set ?? []) images.set(img.name, img.data)
    const merged: Saved = { ...saved, ...next, updatedAt: new Date().toISOString() }
    const keep = referenced(merged.panel)
    for (const name of [...images.keys()]) if (!keep.has(name)) images.delete(name)

    const channel = await findConfigChannel(client, merged.panel.channelId)
    const files = [new AttachmentBuilder(Buffer.from(JSON.stringify(merged, null, 2)), { name: CONFIG_FILE })]
    for (const [name, data] of images) files.push(new AttachmentBuilder(data, { name }))
    const posted = await channel.send({ content: `Saved ${merged.updatedAt}. The newest message here is the one the bot uses.`, files })
    saved = merged
    urls.clear()
    for (const a of posted.attachments.values()) if (a.name !== CONFIG_FILE) urls.set(a.name, a.url)

    // tidy up: older config messages are no longer needed
    const old = await channel.messages.fetch({ limit: 50 })
    for (const m of old.values()) {
      if (m.id !== posted.id && m.author.id === client.user!.id && m.attachments.some((a) => a.name === CONFIG_FILE)) {
        await m.delete().catch(() => {})
      }
    }
    return saved
  })
  queue = run.catch(() => {})
  return run
}
