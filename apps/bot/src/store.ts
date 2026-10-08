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

// The bot keeps its settings in Discord: one message in a private channel, carrying config.json and the
// roster image as attachments. Saving posts a fresh message and removes the old one, so the newest message is
// always the truth. No database, nothing else to host.

const CONFIG_FILE = 'vexx-config.json'
const CONFIG_CHANNEL_NAME = 'vexx-bot-config'

export type Saved = {
  panel: Panel
  messageId: string | null
  publishedAt: string | null
  updatedAt: string | null
}

type Image = { name: string; data: Buffer }

let saved: Saved = { panel: defaultPanel, messageId: null, publishedAt: null, updatedAt: null }
let image: Image | null = null
let imageUrl: string | null = null
let configChannel: TextChannel | null = null
let loaded = false
// saves run one at a time, so two quick edits cannot leave two config messages behind
let queue: Promise<unknown> = Promise.resolve()

export const current = () => saved
export const rosterImage = () => image
export const rosterImageUrl = () => imageUrl
export const isLoaded = () => loaded

async function panelGuild(client: Client, channelId: string): Promise<Guild> {
  const channel = await client.channels.fetch(channelId).catch(() => null)
  if (!channel || !('guild' in channel) || !channel.guild) {
    throw new Error(`The bot cannot see channel ${channelId}. Invite the bot to that server first.`)
  }
  return channel.guild
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

// Reads the newest saved config (and roster image) from Discord. Safe to call again; it refreshes the cache.
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
    publishedAt: typeof raw.publishedAt === 'string' ? raw.publishedAt : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  }
  const pic = saved.panel.roster.imageName ? message.attachments.find((a) => a.name === saved.panel.roster.imageName) : undefined
  if (pic) {
    image = { name: pic.name, data: Buffer.from(await (await fetch(pic.url)).arrayBuffer()) }
    imageUrl = pic.url
  } else {
    image = null
    imageUrl = null
  }
  loaded = true
}

// Writes the config (and the current roster image) as a new message, then removes older config messages.
export function save(client: Client, next: Partial<Saved>, nextImage?: Image | null): Promise<Saved> {
  const run = queue.then(async () => {
    const merged: Saved = { ...saved, ...next, updatedAt: new Date().toISOString() }
    if (nextImage !== undefined) {
      image = nextImage
      merged.panel = { ...merged.panel, roster: { ...merged.panel.roster, imageName: nextImage?.name ?? null } }
    }
    const channel = await findConfigChannel(client, merged.panel.channelId)
    const files = [new AttachmentBuilder(Buffer.from(JSON.stringify(merged, null, 2)), { name: CONFIG_FILE })]
    if (image && merged.panel.roster.imageName) files.push(new AttachmentBuilder(image.data, { name: image.name }))
    const posted = await channel.send({ content: `Saved ${merged.updatedAt}. The newest message here is the one the bot uses.`, files })
    saved = merged
    imageUrl = image ? (posted.attachments.find((a) => a.name === image!.name)?.url ?? null) : null
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
