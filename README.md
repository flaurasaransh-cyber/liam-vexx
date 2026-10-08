# VEXX Discord bot + admin panel

Turborepo with two apps and one shared package:

- `apps/bot` — discord.js bot. Posts the VEXX About panel (embed, logo, VEXX Media link, Roster button) and answers the Roster button privately. Also serves the API the admin panel uses. Settings live in Discord itself (a private `vexx-bot-config` channel), so there is no database.
- `apps/admin` — React admin panel (Vite). Edit the panel and roster, preview it, publish.
- `packages/shared` — types, validation and defaults used by both.

## Run locally

```
npm install
cp apps/bot/.env.example apps/bot/.env      # fill in DISCORD_TOKEN, ADMIN_PASSWORD, SESSION_SECRET
cp apps/admin/.env.example apps/admin/.env
npm run build
npm run dev
```

## Deploy (Render)

`render.yaml` defines both: the bot as a web service and the admin as a static site.
The bot pings itself every 10 minutes so the free instance does not sleep.
