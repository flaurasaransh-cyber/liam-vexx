import { ChannelType, Client, Events, GatewayIntentBits, MessageFlags, type GuildMember, type TextChannel } from 'discord.js'
import { ROSTER_BUTTON_ID, type ChannelOption } from '@vexx/shared'
import { aboutMessage, rosterMessage, welcomeMessage } from './panel.js'
import { current, load, save, serverOf } from './store.js'

// Guilds for channels and buttons; GuildMembers (switched on in the developer portal) to see people join.
// The bot reads no chat messages, so it does not need the message content intent.
export const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] })

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

function memberDetails(member: GuildMember) {
  return {
    id: member.id,
    username: member.displayName,
    avatarUrl: member.displayAvatarURL({ size: 256, extension: 'png' }),
    server: member.guild.name,
    count: member.guild.memberCount,
  }
}

client.on(Events.GuildMemberAdd, async (member) => {
  const { welcome } = current().panel
  if (!welcome.enabled || !welcome.channelId || member.user.bot) return
  try {
    const channel = await panelChannel(welcome.channelId)
    if (channel.guildId !== member.guild.id) return
    await channel.send(welcomeMessage(current().panel, memberDetails(member)))
  } catch (err) {
    console.error('Welcome failed:', err instanceof Error ? err.message : err)
  }
})

// Sends a sample welcome to the chosen channel, with the bot standing in for the new member. Each test moves the
// rotation on by one, so pressing it again shows the next text and banner.
let testStep = 0
export async function sendTestWelcome(): Promise<{ url: string }> {
  const { welcome } = current().panel
  if (!welcome.channelId) throw new Error('Pick a welcome channel first.')
  const channel = await panelChannel(welcome.channelId)
  const me = channel.guild.members.me ?? (await channel.guild.members.fetchMe())
  const details = { ...memberDetails(me), count: channel.guild.memberCount + testStep++ }
  const sent = await channel.send(welcomeMessage(current().panel, details))
  return { url: sent.url }
}

// Text channels in the server, for the welcome channel picker.
export async function textChannels(): Promise<ChannelOption[]> {
  const guild = await serverOf(client)
  const channels = await guild.channels.fetch()
  const me = guild.members.me ?? (await guild.members.fetchMe())
  return [...channels.values()]
    .filter((c): c is TextChannel => Boolean(c) && (c!.type === ChannelType.GuildText || c!.type === ChannelType.GuildAnnouncement))
    .filter((c) => c.permissionsFor(me)?.has(['ViewChannel', 'SendMessages']))
    .filter((c) => c.name !== 'vexx-bot-config')
    .sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition)
    .map((c) => ({ id: c.id, name: c.name, category: c.parent?.name ?? null }))
}
