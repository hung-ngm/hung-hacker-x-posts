import type { Post } from "@/post";
import {
  mergeIncludes,
  type ApiMedia,
  type ApiTweet,
  type ApiUser,
  type Includes,
  type UrlEntity,
} from "@/x";

const TITLE_CHARS = 80;

type Indexes = {
  userById: Map<string, ApiUser>;
  mediaByKey: Map<string, ApiMedia>;
  tweetById: Map<string, ApiTweet>;
};

export function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => codePoint(parseInt(num, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function codePoint(value: number): string {
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return "";
  return String.fromCodePoint(value);
}

export function excerpt(text: string): string {
  const clean = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= TITLE_CHARS) return clean;
  return `${clean.slice(0, TITLE_CHARS).trimEnd()}…`;
}

function urlsOf(tweet: ApiTweet): UrlEntity[] {
  return tweet.note_tweet?.entities?.urls ?? tweet.entities?.urls ?? [];
}

function isXHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return (
    host === "x.com" ||
    host === "twitter.com" ||
    host === "t.co" ||
    host.endsWith(".x.com") ||
    host.endsWith(".twitter.com")
  );
}

export function primaryExternalUrl(tweet: ApiTweet): string | null {
  for (const entity of urlsOf(tweet)) {
    if (entity.media_key) continue;
    const raw = entity.expanded_url || entity.url;
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (isXHost(parsed.hostname)) continue;
      return raw;
    } catch {
      continue;
    }
  }
  return null;
}

function articleUrl(tweet: ApiTweet): string | null {
  const urls = [
    ...(tweet.entities?.urls ?? []),
    ...(tweet.note_tweet?.entities?.urls ?? []),
  ];
  for (const entity of urls) {
    const raw = entity.expanded_url || "";
    if (raw.includes("/i/article/")) return raw;
  }
  return null;
}

function domainOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function displayText(tweet: ApiTweet): string {
  const source = tweet.note_tweet?.text ?? tweet.text ?? "";
  const entities = tweet.note_tweet
    ? (tweet.note_tweet.entities?.urls ?? [])
    : (tweet.entities?.urls ?? []);
  let text = source;
  for (const entity of entities) {
    if (!entity.url) continue;
    const replacement = entity.media_key ? "" : entity.expanded_url || entity.url;
    text = text.split(entity.url).join(replacement);
  }
  return decodeHtml(text)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function imagesOf(tweet: ApiTweet, mediaByKey: Map<string, ApiMedia>) {
  const images = [];
  for (const key of tweet.attachments?.media_keys ?? []) {
    const media = mediaByKey.get(key);
    if (!media) continue;
    const url = media.type === "photo" ? media.url : media.preview_image_url;
    if (!url) continue;
    images.push({
      url,
      width: media.width ?? 0,
      height: media.height ?? 0,
    });
  }
  return images;
}

function quoteOf(tweet: ApiTweet, indexes: Indexes): Post["quote"] {
  const ref = tweet.referenced_tweets?.find((item) => item.type === "quoted");
  if (!ref) return null;
  const quoted = indexes.tweetById.get(ref.id);
  if (!quoted) {
    return { id: ref.id, authorUsername: "unknown", text: "", images: [] };
  }
  const username = quoted.author_id
    ? indexes.userById.get(quoted.author_id)?.username
    : undefined;
  return {
    id: quoted.id,
    authorUsername: username || "unknown",
    text: displayText(quoted),
    images: imagesOf(quoted, indexes.mediaByKey),
  };
}

function indexesFor(includes: Includes, tweets: ApiTweet[]): Indexes {
  const tweetById = new Map<string, ApiTweet>();
  for (const tweet of includes.tweets ?? []) tweetById.set(tweet.id, tweet);
  for (const tweet of tweets) tweetById.set(tweet.id, tweet);
  return {
    userById: new Map((includes.users ?? []).map((user) => [user.id, user])),
    mediaByKey: new Map(
      (includes.media ?? []).map((media) => [media.media_key, media]),
    ),
    tweetById,
  };
}

function metricsOf(tweet: ApiTweet): { likes: number; reposts: number } | null {
  if (!tweet.public_metrics) return null;
  return {
    likes: tweet.public_metrics.like_count ?? 0,
    reposts: tweet.public_metrics.retweet_count ?? 0,
  };
}

function withMetrics(
  prev: Post,
  metrics: { likes: number; reposts: number },
): Post {
  return {
    id: prev.id,
    bookmarkedAt: prev.bookmarkedAt,
    authorUsername: prev.authorUsername,
    text: prev.text,
    title: prev.title,
    url: prev.url,
    domain: prev.domain,
    likes: metrics.likes,
    reposts: metrics.reposts,
    quote: prev.quote,
    images: prev.images,
  };
}

function uniqueNew(ids: string[], times: Map<string, string>): string[] {
  const seen = new Set<string>();
  const fresh: string[] = [];
  for (const id of ids) {
    if (times.has(id) || seen.has(id)) continue;
    seen.add(id);
    fresh.push(id);
  }
  return fresh;
}

function assignNewer(ids: string[], times: Map<string, string>, now: number) {
  const fresh = uniqueNew(ids, times);
  if (fresh.length === 0) return;
  let newest = Number.NEGATIVE_INFINITY;
  for (const value of times.values()) {
    const ms = Date.parse(value);
    if (ms > newest) newest = ms;
  }
  const start = Math.max(
    now,
    Number.isFinite(newest) ? newest + fresh.length * 1000 : now,
  );
  fresh.forEach((id, index) => {
    times.set(id, new Date(start - index * 1000).toISOString());
  });
}

function assignFlat(ids: string[], times: Map<string, string>, now: number) {
  if (!ids.some((id) => times.has(id))) {
    assignNewer(ids, times, now);
    return;
  }
  let index = 0;
  while (index < ids.length) {
    if (times.has(ids[index]!)) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < ids.length && !times.has(ids[index]!)) index += 1;
    const run = uniqueNew(ids.slice(start, index), times);
    if (run.length === 0) continue;
    const above = start > 0 ? Date.parse(times.get(ids[start - 1]!)!) : undefined;
    const below = index < ids.length ? Date.parse(times.get(ids[index]!)!) : undefined;
    if (above === undefined) {
      assignNewer(run, times, now);
      continue;
    }
    placeBetween(run, above, below, times);
  }
}

function placeBetween(
  run: string[],
  above: number,
  floor: number | undefined,
  times: Map<string, string>,
) {
  if (floor === undefined || !Number.isFinite(floor)) {
    run.forEach((id, index) => {
      times.set(id, new Date(above - (index + 1) * 1000).toISOString());
    });
    return;
  }
  const room = above - floor;
  const step = room > run.length ? Math.floor(room / (run.length + 1)) : 1;
  run.forEach((id, index) => {
    const ms = above - step * (index + 1);
    times.set(id, new Date(ms > floor ? ms : above - (index + 1)).toISOString());
  });
}

function assignOlder(ids: string[], times: Map<string, string>, now: number) {
  if (uniqueNew(ids, times).length === 0) return;
  if (times.size === 0) {
    assignNewer(ids, times, now);
    return;
  }
  let oldest = Number.POSITIVE_INFINITY;
  for (const value of times.values()) {
    const ms = Date.parse(value);
    if (ms < oldest) oldest = ms;
  }
  uniqueNew(ids, times).forEach((id, index) => {
    times.set(id, new Date(oldest - (index + 1) * 1000).toISOString());
  });
}

async function titleFor(
  tweet: ApiTweet,
  text: string,
  fetchTitle: (url: string) => Promise<string | null>,
): Promise<{ title: string; url: string | null; domain: string | null }> {
  const external = primaryExternalUrl(tweet);
  if (external) {
    const fetched = cleanTitle(await fetchTitle(external));
    return {
      title: fetched || excerpt(text),
      url: external,
      domain: domainOf(external),
    };
  }
  const headline = tweet.article?.title?.trim();
  if (headline) {
    return { title: cleanTitle(headline) || headline, url: articleUrl(tweet), domain: null };
  }
  return { title: excerpt(text), url: null, domain: null };
}

function cleanTitle(value: string | null | undefined): string {
  if (!value) return "";
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

async function buildPost(
  tweet: ApiTweet,
  indexes: Indexes,
  bookmarkedAt: string,
  fetchTitle: (url: string) => Promise<string | null>,
): Promise<Post> {
  const text = displayText(tweet);
  const titled = await titleFor(tweet, text, fetchTitle);
  const username = tweet.author_id
    ? indexes.userById.get(tweet.author_id)?.username
    : undefined;
  const metrics = metricsOf(tweet);
  return {
    id: tweet.id,
    bookmarkedAt,
    authorUsername: username || "unknown",
    text,
    title: titled.title,
    url: titled.url,
    domain: titled.domain,
    likes: metrics?.likes ?? 0,
    reposts: metrics?.reposts ?? 0,
    quote: quoteOf(tweet, indexes),
    images: imagesOf(tweet, indexes.mediaByKey),
  };
}

export async function syncBookmarks(input: {
  existing: Post[];
  now: Date;
  flatTweets: ApiTweet[];
  flatIncludes: Includes;
  folderTweets?: ApiTweet[];
  folderIncludes?: Includes;
  fetchTitle: (url: string) => Promise<string | null>;
}): Promise<Post[]> {
  const existingById = new Map(input.existing.map((post) => [post.id, post]));
  const times = new Map<string, string>();
  for (const post of input.existing) times.set(post.id, post.bookmarkedAt);

  const now = input.now.getTime();
  assignFlat(
    input.flatTweets.map((tweet) => tweet.id),
    times,
    now,
  );
  assignOlder(
    (input.folderTweets ?? []).map((tweet) => tweet.id),
    times,
    now,
  );

  const flatIndexes = indexesFor(
    mergeIncludes([input.flatIncludes]),
    input.flatTweets,
  );
  const folderIndexes = indexesFor(
    input.folderIncludes ?? {},
    input.folderTweets ?? [],
  );
  const incoming = new Map<string, Post>();

  for (const tweet of input.flatTweets) {
    const previous = existingById.get(tweet.id) ?? incoming.get(tweet.id);
    const metrics = metricsOf(tweet);
    if (previous && metrics) {
      incoming.set(tweet.id, withMetrics(previous, metrics));
      continue;
    }
    if (previous) {
      incoming.set(tweet.id, previous);
      continue;
    }
    const bookmarkedAt = times.get(tweet.id);
    if (!bookmarkedAt) throw new Error(`Missing bookmarkedAt for ${tweet.id}`);
    incoming.set(
      tweet.id,
      await buildPost(tweet, flatIndexes, bookmarkedAt, input.fetchTitle),
    );
  }

  for (const tweet of input.folderTweets ?? []) {
    const previous = incoming.get(tweet.id) ?? existingById.get(tweet.id);
    const metrics = metricsOf(tweet);
    if (previous && metrics) {
      incoming.set(tweet.id, withMetrics(previous, metrics));
      continue;
    }
    if (previous) {
      incoming.set(tweet.id, previous);
      continue;
    }
    const bookmarkedAt = times.get(tweet.id);
    if (!bookmarkedAt) throw new Error(`Missing bookmarkedAt for ${tweet.id}`);
    incoming.set(
      tweet.id,
      await buildPost(tweet, folderIndexes, bookmarkedAt, input.fetchTitle),
    );
  }

  const merged = new Map<string, Post>();
  for (const post of input.existing) {
    merged.set(post.id, incoming.get(post.id) ?? post);
  }
  for (const [id, post] of incoming) {
    if (!merged.has(id)) merged.set(id, post);
  }
  return [...merged.values()];
}

export function serializePosts(posts: Post[]): string {
  const sorted = [...posts].sort((a, b) => {
    if (a.bookmarkedAt !== b.bookmarkedAt) {
      return a.bookmarkedAt < b.bookmarkedAt ? 1 : -1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

export async function fetchPageTitle(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          "hung-hacker-x-posts/1.0 (+https://github.com/hung-ngm/hung-hacker-x-posts)",
      },
    });
    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 250_000);
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return null;
    const title = decodeHtml(match[1]).replace(/\s+/g, " ").trim();
    return title || null;
  } catch {
    return null;
  }
}
