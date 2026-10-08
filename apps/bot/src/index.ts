import { env } from './env.js'
import { app } from './api.js'
import { client } from './discord.js'

app.listen(env.port, () => console.log(`API listening on port ${env.port}`))
await client.login(env.token)

// Render's free web service sleeps after 15 minutes without a visit, which would drop the Discord connection
// and leave the Roster button unanswered. A visit to itself every 10 minutes keeps it awake.
if (env.publicUrl) {
  setInterval(() => {
    fetch(`${env.publicUrl}/health`).catch(() => {})
  }, 10 * 60_000)
}

process.on('unhandledRejection', (err) => console.error('Unhandled error:', err))
