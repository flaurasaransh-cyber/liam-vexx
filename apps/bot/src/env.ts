// Settings from the environment. A missing required value stops the bot at start with a plain message.
function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(`Missing ${name}. Copy apps/bot/.env.example to apps/bot/.env (or set it on Render) and fill it in.`)
    process.exit(1)
  }
  return value
}

export const env = {
  token: required('DISCORD_TOKEN'),
  adminPassword: required('ADMIN_PASSWORD'),
  sessionSecret: required('SESSION_SECRET'),
  adminOrigins: (process.env.ADMIN_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  configChannelId: process.env.CONFIG_CHANNEL_ID?.trim() || null,
  port: Number(process.env.PORT) || 3000,
  // Render sets this; the bot pings itself so the free instance never sleeps and drops the Discord connection
  publicUrl: process.env.RENDER_EXTERNAL_URL?.trim() || null,
}
