import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type BaseMessageOptions,
} from 'discord.js'
import { ROSTER_BUTTON_ID, fillPlaceholders, spotFor, type Panel } from '@vexx/shared'
import { bannerWithAvatar } from './compose.js'
import { image, rosterImage } from './store.js'

const logo = readFileSync(fileURLToPath(new URL('../assets/logo.png', import.meta.url)))
const LOGO_NAME = 'vexx-logo.png'
const colour = (hex: string) => Number.parseInt(hex.slice(1), 16)

// The About panel: the orange-edged embed with the logo on the right, the tagline in bold at the end, and the
// buttons under it (a link to VEXX Media, and Roster, which answers privately).
export function aboutMessage(panel: Panel): BaseMessageOptions {
  const { about } = panel
  const embed = new EmbedBuilder()
    .setColor(colour(about.color))
    .setTitle(about.title)
    .setDescription(about.tagline ? `${about.body}\n\n**${about.tagline}**` : about.body)
  const files: AttachmentBuilder[] = []
  if (about.showLogo) {
    embed.setThumbnail(`attachment://${LOGO_NAME}`)
    files.push(new AttachmentBuilder(logo, { name: LOGO_NAME }))
  }

  const buttons: ButtonBuilder[] = []
  if (about.mediaUrl) {
    const media = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(about.mediaLabel || 'VEXX Media').setURL(about.mediaUrl)
    if (about.mediaEmoji) media.setEmoji(about.mediaEmoji)
    buttons.push(media)
  }
  const roster = new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(about.rosterLabel).setCustomId(ROSTER_BUTTON_ID)
  if (about.rosterEmoji) roster.setEmoji(about.rosterEmoji)
  buttons.push(roster)

  return {
    embeds: [embed],
    files,
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
  }
}

function list(members: Panel['roster']['team']) {
  if (members.length === 0) return '_To be announced_'
  return members.map((m) => `🔸 **${m.name}**${m.role ? ` — ${m.role}` : ''}`).join('\n')
}

// What someone sees after pressing Roster: only to them, so the channel stays clean. Laid out as one description
// with large headings and a blank line between sections (fields render cramped on phones), and no corner logo, so
// the names get the full width.
export function rosterMessage(panel: Panel): BaseMessageOptions {
  const { roster, about } = panel
  const description = [`### ${roster.teamHeading}`, list(roster.team), '', `### ${roster.staffHeading}`, list(roster.staff)].join('\n')
  const embed = new EmbedBuilder().setColor(colour(about.color)).setTitle(roster.title).setDescription(description)
  if (about.tagline) embed.setFooter({ text: about.tagline })
  const files: AttachmentBuilder[] = []
  const pic = rosterImage()
  if (pic) {
    embed.setImage(`attachment://${pic.name}`)
    files.push(new AttachmentBuilder(pic.data, { name: pic.name }))
  }
  return { embeds: [embed], files }
}

// The welcome a new member gets. Text and banner both rotate: member number N gets text N and banner N (wrapping
// round), so consecutive joins see different ones without anything being stored per join. The member's profile
// picture is drawn onto the banner where that banner says it goes.
export async function welcomeMessage(
  panel: Panel,
  member: { id: string; username: string; avatarUrl: string; server: string; count: number },
): Promise<BaseMessageOptions> {
  const { welcome } = panel
  const values = { user: `<@${member.id}>`, username: member.username, server: member.server, count: member.count }
  const text = welcome.messages[member.count % welcome.messages.length] ?? ''
  const embed = new EmbedBuilder().setColor(colour(welcome.color)).setDescription(fillPlaceholders(text, values))
  if (welcome.title) embed.setTitle(fillPlaceholders(welcome.title, { ...values, user: member.username }))
  if (panel.about.tagline) embed.setFooter({ text: panel.about.tagline })

  const files: AttachmentBuilder[] = []
  const name = welcome.banners.length ? welcome.banners[member.count % welcome.banners.length] : null
  const banner = image(name)
  const spot = name ? spotFor(welcome, name) : 'none'
  let onBanner = false
  if (banner) {
    let data = banner.data
    if (welcome.showAvatar && spot !== 'none') {
      try {
        const avatar = Buffer.from(await (await fetch(member.avatarUrl)).arrayBuffer())
        data = await bannerWithAvatar(banner.data, avatar, spot, welcome.color)
        onBanner = true
      } catch (err) {
        console.error('Could not put the profile picture on the banner:', err instanceof Error ? err.message : err)
      }
    }
    const fileName = onBanner ? 'welcome.png' : banner.name
    embed.setImage(`attachment://${fileName}`)
    files.push(new AttachmentBuilder(data, { name: fileName }))
  }
  if (welcome.showAvatar) {
    embed.setAuthor({ name: member.username, iconURL: member.avatarUrl })
    // the corner picture only when it is not already on the banner
    if (!onBanner) embed.setThumbnail(member.avatarUrl)
  }
  return {
    content: welcome.mention ? `<@${member.id}>` : undefined,
    embeds: [embed],
    files,
    allowedMentions: { users: welcome.mention ? [member.id] : [] },
  }
}
