import { z } from 'zod'

// Everything the admin panel can change. It lives in Discord itself (a file in a private config channel),
// so there is no database to run.

const url = z.string().trim().url().max(500)
const optionalUrl = z.union([url, z.literal('')])
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #FF5A1F')

export const memberSchema = z.object({
  name: z.string().trim().min(1, 'Add a name').max(60),
  role: z.string().trim().max(60).default(''),
})
export type Member = z.infer<typeof memberSchema>

export const aboutSchema = z.object({
  title: z.string().trim().min(1).max(256),
  body: z.string().trim().min(1).max(3500),
  tagline: z.string().trim().max(200).default(''),
  color: hex,
  showLogo: z.boolean().default(true),
  mediaLabel: z.string().trim().max(80).default(''),
  // a single emoji shown on the button, e.g. ☑️ (optional)
  mediaEmoji: z.string().trim().max(32).default(''),
  mediaUrl: optionalUrl.default(''),
  rosterLabel: z.string().trim().min(1).max(80),
  rosterEmoji: z.string().trim().max(32).default(''),
})
export type About = z.infer<typeof aboutSchema>

export const rosterSchema = z.object({
  title: z.string().trim().min(1).max(256),
  teamHeading: z.string().trim().min(1).max(80),
  team: z.array(memberSchema).max(25),
  staffHeading: z.string().trim().min(1).max(80),
  staff: z.array(memberSchema).max(25),
  // set by the bot when an image is uploaded; the file itself sits next to the config in Discord
  imageName: z.string().max(120).nullable().default(null),
})
export type Roster = z.infer<typeof rosterSchema>

// Welcome messages for new members. Several texts and several banners can be set; each new member gets the next
// one of each in turn (worked out from the member count, so nothing has to be stored per join).
export const welcomeSchema = z.object({
  enabled: z.boolean(),
  channelId: z.union([z.literal(''), z.string().regex(/^\d{17,20}$/, 'Pick a welcome channel')]),
  title: z.string().trim().max(256),
  messages: z.array(z.string().trim().min(1, 'A welcome text cannot be empty').max(1500)).min(1, 'Add at least one welcome text').max(10),
  color: hex,
  mention: z.boolean(),
  showAvatar: z.boolean(),
  // file names of the uploaded banners, in rotation order; set by the bot when banners are uploaded
  banners: z.array(z.string().max(120)).max(8),
})
export type Welcome = z.infer<typeof welcomeSchema>

export const defaultWelcome: Welcome = {
  enabled: false,
  channelId: '',
  title: 'Welcome to VEXX',
  messages: [
    'Hey {user}, welcome to **{server}**! You are member **#{count}**. Defy The Expected. 🔥',
    '{user} just landed in **{server}**. Make yourself at home, you are member **#{count}**. 🧡',
  ],
  color: '#FF5A1F',
  mention: true,
  showAvatar: true,
  banners: [],
}

// Words that are swapped in when a welcome is sent.
export const PLACEHOLDERS = [
  { key: '{user}', means: 'mentions the new member' },
  { key: '{username}', means: 'their name, without a ping' },
  { key: '{server}', means: 'the server name' },
  { key: '{count}', means: 'how many members the server has now' },
] as const

export function fillPlaceholders(text: string, values: { user: string; username: string; server: string; count: number }) {
  return text
    .replaceAll('{user}', values.user)
    .replaceAll('{username}', values.username)
    .replaceAll('{server}', values.server)
    .replaceAll('{count}', String(values.count))
}

export const panelSchema = z.object({
  channelId: z.string().regex(/^\d{17,20}$/, 'A Discord channel ID is 17 to 20 digits'),
  about: aboutSchema,
  roster: rosterSchema,
  welcome: welcomeSchema.default(defaultWelcome),
})
export type Panel = z.infer<typeof panelSchema>

export type ChannelOption = { id: string; name: string; category: string | null }

// What the bot reports back alongside the panel.
export type PanelState = {
  panel: Panel
  // the published message, if there is one
  messageId: string | null
  messageUrl: string | null
  publishedAt: string | null
  updatedAt: string | null
  rosterImageUrl: string | null
  banners: { name: string; url: string | null }[]
  bot: { name: string; avatarUrl: string | null; online: boolean; guilds: { id: string; name: string }[] }
}

export const DEFAULT_CHANNEL_ID = '1557494024829534249'

export const defaultPanel: Panel = {
  channelId: DEFAULT_CHANNEL_ID,
  about: {
    title: 'WELCOME TO VEXX',
    body:
      'We are built for the moments that define competitors. An esports organisation driven by elite talent, intelligence, and an uncompromising desire of excellence. We exist to create the standard, develop players who rise to the occasion, and build a legacy that extends far beyond the scoreboard. Every decision, every match, every opportunity — we pursue it with purpose.',
    tagline: 'Defy The Expected',
    color: '#FF5A1F',
    showLogo: true,
    mediaLabel: 'VEXX Media',
    mediaEmoji: '☑️',
    mediaUrl: '',
    rosterLabel: 'Roster',
    rosterEmoji: '🏆',
  },
  roster: {
    title: '🔥 VEXX Roster',
    teamHeading: '🎮 Team',
    team: [],
    staffHeading: '🛠️ Staff',
    staff: [],
    imageName: null,
  },
  welcome: defaultWelcome,
}

export const ROSTER_BUTTON_ID = 'vexx:roster'

// Button and embed limits Discord enforces, so the panel can warn before the bot is refused.
export const LIMITS = { embedDescription: 4096, embedTitle: 256, buttonLabel: 80 } as const
