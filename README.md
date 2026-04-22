# Youtuby

Telegram bot to browse YouTube search results through Invidious and hand off selected URLs to `@MegaSaverBot`.

## Features

- `/search <query>` and plain text queries
- Returns configurable `N` results (`RESULT_LIMIT`, default `10`)
- Shows thumbnail + basic metadata for each result
- Inline "Select" button per result
- On selection, sends a button to open `@MegaSaverBot` and includes the selected YouTube URL
- In-memory TTL session storage
- Basic per-user rate limiting

## Setup

1. Copy `.env.example` to `.env`
2. Fill in `BOT_TOKEN` and `INVIDIOUS_BASE_URL`
3. Install dependencies:

```bash
bun install
```

4. Run in dev:

```bash
bun run dev
```

## Scripts

- `bun run dev`
- `bun run build`
- `bun run start`
- `bun run test`
- `bun run lint`
