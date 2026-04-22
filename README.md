# Youtuby

Telegram bot that searches YouTube through a headless Chromium (Playwright) and hands off selected URLs to `@MegaSaverBot`.

## Features

- `/search <query>` and plain text queries
- Returns configurable `N` results (`RESULT_LIMIT`, default `10`)
- Shows thumbnail + basic metadata for each result
- Inline "Select" button per result
- On selection, sends a button to open `@MegaSaverBot` and includes the selected YouTube URL
- In-memory TTL session storage
- Basic per-user rate limiting
- Results fetched via a headless Chromium reading `ytInitialData` from the YouTube results page

## Setup

1. Copy `.env.example` to `.env` and fill in `BOT_TOKEN`
2. Install dependencies:

```bash
bun install
```

3. Install the Chromium binary used by Playwright (only needed once):

```bash
bunx playwright install chromium
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

## Docker Compose

The `Dockerfile` installs Chromium and all required system libraries automatically via `playwright install --with-deps chromium`.

1. Create `.env` from `.env.example`
2. Build and run:

```bash
docker compose up -d --build
```

3. View logs:

```bash
docker compose logs -f
```

4. Stop:

```bash
docker compose down
```
