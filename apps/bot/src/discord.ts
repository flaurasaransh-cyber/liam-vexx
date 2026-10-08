import { ChannelType, Client, Events, GatewayIntentBits, MessageFlags, type TextChannel } from 'discord.js'
import { ROSTER_BUTTON_ID } from '@vexx/shared'
import { aboutMessage, rosterMessage } from './panel.js'
import { current, load, save } from './store.js'

// Only the Guilds intent: the bot reads no chat messages, so it needs no privileged intents.
export const client = new Client({ intents: [GatewayIntentBits.Guilds] })

client.once(Events.ClientReady, async (c) => {
  console.log(`Signed in to Discord as ${c.user.tag}, in ${c.guilds.cache.size} server(s).`)
  try {
    await load(c)
    console.log('Loaded the saved panel settings.')
  } catch (err) {
    console.error('Could not load the saved settings yet:', err instanceof Error ? err.message : err)
  }
})

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== ROSTER_BUTTON_ID) return
  try {
    await interaction.reply({ ...rosterMessage(current().panel), flags: MessageFlags.Ephemeral })
  } catch (err) {
    console.error('Roster button failed:', err)
    if (!interaction.replied) await interaction.reply({ content: 'The roster could not be shown right now.', flags: MessageFlags.Ephemeral }).catch(() => {})
  }
})

async function panelChannel(channelId: string): Promise<TextChannel> {
  const ch = await client.channels.fetch(channelId).catch(() => null)
  if (!ch) throw new Error(`The bot cannot see channel ${channelId}. Invite it to that server and make sure it can view the channel.`)
  if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) throw new Error('That channel is not a text channel.')
  return ch as TextChannel
}

// Posts the panel, or edits the one already posted so the channel keeps a single panel.
export async function publish(): Promise<{ messageId: string; url: string; edited: boolean }> {
  const { panel, messageId } = current()
  const channel = await panelChannel(panel.channelId)
  const payload = aboutMessage(panel)
  if (messageId) {
    const existing = await channel.messages.fetch(messageId).catch(() => null)
    if (existing) {
      const edited = await existing.edit({ ...payload, attachments: [] })
      await save(client, { publishedAt: new Date().toISOString() })
      return { messageId: edited.id, url: edited.url, edited: true }
    }
  }
  const sent = await channel.send(payload)
  await save(client, { messageId: sent.id, publishedAt: new Date().toISOString() })
  return { messageId: sent.id, url: sent.url, edited: false }
}

export function messageUrl(): string | null {
  const { panel, messageId } = current()
  if (!messageId) return null
  const ch = client.channels.cache.get(panel.channelId)
  const guildId = ch && 'guildId' in ch ? ch.guildId : null
  return guildId ? `https://discord.com/channels/${guildId}/${panel.channelId}/${messageId}` : null
}
