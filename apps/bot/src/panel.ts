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
import { ROSTER_BUTTON_ID, type Panel } from '@vexx/shared'
import { rosterImage } from './store.js'

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
    buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(about.mediaLabel || 'VEXX Media').setURL(about.mediaUrl))
  }
  buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(about.rosterLabel).setCustomId(ROSTER_BUTTON_ID))

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

// What someone sees after pressing Roster: only to them, so the channel stays clean.
export function rosterMessage(panel: Panel): BaseMessageOptions {
  const { roster, about } = panel
  const embed = new EmbedBuilder()
    .setColor(colour(about.color))
    .setTitle(roster.title)
    .addFields(
      { name: roster.teamHeading, value: list(roster.team) },
      { name: roster.staffHeading, value: list(roster.staff) },
    )
  if (about.tagline) embed.setFooter({ text: about.tagline })
  const files: AttachmentBuilder[] = []
  if (about.showLogo) {
    embed.setThumbnail(`attachment://${LOGO_NAME}`)
    files.push(new AttachmentBuilder(logo, { name: LOGO_NAME }))
  }
  const pic = rosterImage()
  if (pic) {
    embed.setImage(`attachment://${pic.name}`)
    files.push(new AttachmentBuilder(pic.data, { name: pic.name }))
  }
  return { embeds: [embed], files }
}
