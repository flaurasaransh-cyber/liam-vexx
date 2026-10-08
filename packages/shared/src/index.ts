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

export const panelSchema = z.object({
  channelId: z.string().regex(/^\d{17,20}$/, 'A Discord channel ID is 17 to 20 digits'),
  about: aboutSchema,
  roster: rosterSchema,
})
export type Panel = z.infer<typeof panelSchema>

// What the bot reports back alongside the panel.
export type PanelState = {
  panel: Panel
  // the published message, if there is one
  messageId: string | null
  messageUrl: string | null
  publishedAt: string | null
  updatedAt: string | null
  rosterImageUrl: string | null
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
}

export const ROSTER_BUTTON_ID = 'vexx:roster'

// Button and embed limits Discord enforces, so the panel can warn before the bot is refused.
export const LIMITS = { embedDescription: 4096, embedTitle: 256, buttonLabel: 80 } as const
