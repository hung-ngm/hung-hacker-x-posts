# hung-hacker-x-posts

A Hacker News style list of X bookmarks from [@hungng_m](https://x.com/hungng_m).

A GitHub Actions job reads the account's bookmarks once a day and commits `data/posts.json`. The site is a static Next.js app. It has no database and does not call the X API when someone opens a page.

Points are like counts. The front page ranks by likes plus reposts, using the Hacker News gravity decay and the time the sync first saw the post. `/new` lists posts in bookmark order. `/from?site=` filters by the domain of the linked page.

## Quickstart

Install [Bun](https://bun.sh), then:

```bash
bun install
cp .env.example .env
bun run sync --backfill
bun dev
```

Open http://localhost:3000.

The repository already contains a small seed in `data/posts.json`, so `bun dev` renders pages before the first sync. `bun run sync` merges the account's bookmarks into that file. It keeps every post, refreshes like and repost counts, and sets `bookmarkedAt` the first time it sees a post.

Run the first sync with `--backfill` so folder bookmarks are included. Later runs can omit it. Daily runs read the flat bookmark list only. That list is a window of about 200 posts, and a sync never deletes a post that has scrolled out of it. To hide a post, add its id to `data/hidden.json`.

## Create an X app

Sync uses OAuth 1.0a user context. A bearer token cannot read bookmarks.

1. Open [developer.x.com](https://developer.x.com) and create a project and an app, or open the app you already use.
2. In the app's user authentication settings, set permissions to **Read**. Write access is not required.
3. If the form requires a callback URL, use `http://localhost:3000`. This sync does not run an OAuth redirect.
4. Open **Keys and tokens**.
5. Copy the consumer **API Key** into `X_API_KEY` and the **API Key Secret** into `X_API_SECRET`.
6. Generate an **Access Token and Secret** for your account. Copy them into `X_ACCESS_TOKEN` and `X_ACCESS_TOKEN_SECRET`. The access token looks like `<digits>-<chars>`.
7. Do not copy the Bearer Token.

Regenerate the access token after you change app permissions. An old token keeps the previous permission set.

Put the four values in `.env`. That file is gitignored. `.env.example` lists the names and stays empty.

## GitHub Actions secrets

`.github/workflows/sync.yml` runs every day at 08:00 Australia/Sydney. GitHub cron is UTC only, so it schedules both `0 21 * * *` and `0 22 * * *` and a gate job keeps the one that matches Sydney's current offset (daylight saving or not). You can also run it from the Actions tab.

In the repository, open **Settings > Secrets and variables > Actions** and add four repository secrets with the same names and values as `.env`:

- `X_API_KEY`
- `X_API_SECRET`
- `X_ACCESS_TOKEN`
- `X_ACCESS_TOKEN_SECRET`

The workflow commits `data/` only when the snapshot changed, then pushes to `main`.

The manual run has a **backfill** input. Leave it off for the daily flat list. Turn it on to read every bookmark folder as well.

There is no bookmark timestamp in the API. `bookmarkedAt` is the first time a sync saw the post. A backfill of a new file assigns times from list order so that order is kept.

## Deploy on Vercel

1. Import `hung-ngm/hung-hacker-x-posts`. Framework preset: Next.js. The repo includes `bun.lock`, so Vercel installs with Bun.
2. Do not add the X API secrets to Vercel. The site only reads `data/posts.json`.
3. Leave the production branch as `main`. A sync push to `main` redeploys the site.

The intended hostname is `hung-hacker-x-posts.vercel.app`.

Search indexing is off. `src/config.ts` exports `noindex`. While it is `true`, pages send `noindex` and `robots.txt` disallows all crawlers. Set it to `false` when you want the site indexed.

## Scripts

- `bun dev` starts the dev server.
- `bun run build` builds the site.
- `bun run start` serves the production build.
- `bun run sync` updates `data/posts.json` from the flat bookmark list.
- `bun run sync --backfill` also reads every bookmark folder.
- `bun test` runs the sync tests.

`loadPosts()` in `src/load-posts.ts` is the only reader of `data/posts.json`. It checks the file with zod and drops ids listed in `data/hidden.json`.
