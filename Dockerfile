FROM oven/bun:1 AS deps
WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY src ./src

# Install Chromium binary + required system libraries for Playwright.
RUN bunx playwright install --with-deps chromium

CMD ["bun", "src/index.ts"]
