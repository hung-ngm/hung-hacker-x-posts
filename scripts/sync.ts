import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { readPosts } from "../src/load-posts";
import { fetchPageTitle, serializePosts, syncBookmarks } from "../src/sync";
import { createXClient } from "../src/x";

const backfill = process.argv.includes("--backfill");

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and set it.`);
  }
  return value;
}

function pooled(
  fetchTitle: (url: string) => Promise<string | null>,
  limit: number,
): (url: string) => Promise<string | null> {
  let active = 0;
  const queue: Array<() => void> = [];
  return (url) =>
    new Promise((resolve, reject) => {
      const run = () => {
        active += 1;
        fetchTitle(url)
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            queue.shift()?.();
          });
      };
      if (active < limit) run();
      else queue.push(run);
    });
}

console.log(backfill ? "Syncing bookmarks (backfill)" : "Syncing bookmarks");

const client = createXClient({
  apiKey: env("X_API_KEY"),
  apiSecret: env("X_API_SECRET"),
  accessToken: env("X_ACCESS_TOKEN"),
  accessTokenSecret: env("X_ACCESS_TOKEN_SECRET"),
});

const userId = await client.userId();
const flat = await client.flatBookmarks(userId);
const folders = backfill ? await client.folderBookmarks(userId) : undefined;
const posts = await syncBookmarks({
  existing: readPosts(),
  now: new Date(),
  flatTweets: flat.tweets,
  flatIncludes: flat.includes,
  folderTweets: folders?.tweets,
  folderIncludes: folders?.includes,
  fetchTitle: pooled(fetchPageTitle, 6),
});

const dir = path.join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "posts.json");
const next = serializePosts(posts);
const prev = existsSync(file) ? readFileSync(file, "utf8") : "";
if (next === prev) {
  console.log(`data/posts.json unchanged (${posts.length} posts)`);
} else {
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, next);
  renameSync(tmp, file);
  console.log(`Wrote ${posts.length} posts to data/posts.json`);
}
