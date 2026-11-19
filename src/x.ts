import { createHmac, randomBytes } from "node:crypto";

export type UrlEntity = {
  url?: string;
  expanded_url?: string;
  media_key?: string;
  title?: string;
};

export type ApiTweet = {
  id: string;
  text?: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
  };
  entities?: { urls?: UrlEntity[] };
  note_tweet?: { text?: string; entities?: { urls?: UrlEntity[] } };
  attachments?: { media_keys?: string[] };
  article?: { title?: string };
  referenced_tweets?: { type: string; id: string }[];
};

export type ApiUser = { id: string; username?: string; name?: string };

export type ApiMedia = {
  media_key: string;
  type?: string;
  url?: string;
  preview_image_url?: string;
  width?: number;
  height?: number;
};

export type Includes = {
  users?: ApiUser[];
  media?: ApiMedia[];
  tweets?: ApiTweet[];
};

export type Credentials = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
};

type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string> },
) => Promise<Response>;

const API = "https://api.x.com";
const TWEET_FIELDS =
  "created_at,public_metrics,entities,note_tweet,referenced_tweets,attachments,article";
const EXPANSIONS = "author_id,attachments.media_keys,referenced_tweets.id";
const USER_FIELDS = "username,name";
const MEDIA_FIELDS = "url,preview_image_url,width,height,type";

export function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function oauthSignature(options: {
  method: string;
  url: string;
  query: Record<string, string>;
  consumerSecret: string;
  tokenSecret: string;
  oauth: Record<string, string>;
}): string {
  const params: Record<string, string> = { ...options.query, ...options.oauth };
  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${rfc3986(key)}=${rfc3986(params[key])}`)
    .join("&");
  const base = [
    options.method.toUpperCase(),
    rfc3986(options.url.split("?")[0]),
    rfc3986(paramString),
  ].join("&");
  const key = `${rfc3986(options.consumerSecret)}&${rfc3986(options.tokenSecret)}`;
  return createHmac("sha1", key).update(base).digest("base64");
}

export function oauthHeader(options: {
  method: string;
  url: string;
  query: Record<string, string>;
  credentials: Credentials;
  nonce?: string;
  timestamp?: string;
}): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: options.credentials.apiKey,
    oauth_nonce: options.nonce ?? randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:
      options.timestamp ?? Math.floor(Date.now() / 1000).toString(),
    oauth_token: options.credentials.accessToken,
    oauth_version: "1.0",
  };
  oauth.oauth_signature = oauthSignature({
    method: options.method,
    url: options.url,
    query: options.query,
    consumerSecret: options.credentials.apiSecret,
    tokenSecret: options.credentials.accessTokenSecret,
    oauth,
  });
  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((key) => `${rfc3986(key)}="${rfc3986(oauth[key])}"`)
      .join(", ")
  );
}

export function mergeIncludes(parts: Includes[]): Includes {
  return {
    users: parts.flatMap((part) => part.users ?? []),
    media: parts.flatMap((part) => part.media ?? []),
    tweets: parts.flatMap((part) => part.tweets ?? []),
  };
}

function asTweets(data: unknown): ApiTweet[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is ApiTweet =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as ApiTweet).id === "string",
  );
}

function postIds(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const ids: string[] = [];
  for (const item of data) {
    if (typeof item === "string") ids.push(item);
    else if (
      item &&
      typeof item === "object" &&
      typeof (item as { id?: unknown }).id === "string"
    ) {
      ids.push((item as { id: string }).id);
    }
  }
  return ids;
}

export function createXClient(
  credentials: Credentials,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
) {
  async function get(
    pathname: string,
    query: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(pathname, API);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetchImpl(url.toString(), {
        headers: {
          Authorization: oauthHeader({
            method: "GET",
            url: `${API}${pathname}`,
            query,
            credentials,
          }),
        },
      });
      if (
        (response.status === 429 || response.status === 503) &&
        attempt === 0
      ) {
        const reset = Number(response.headers.get("x-rate-limit-reset"));
        const waitMs = Number.isFinite(reset)
          ? Math.min(Math.max(0, reset * 1000 - Date.now()), 10_000)
          : 1_000;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      const body = await response.text();
      if (!response.ok) {
        lastError = `GET ${pathname} failed: ${response.status} ${body.slice(0, 500)}`;
        throw new Error(lastError);
      }
      return JSON.parse(body) as Record<string, unknown>;
    }
    throw new Error(lastError || `GET ${pathname} failed`);
  }

  async function pages(
    pathname: string,
    query: Record<string, string>,
  ): Promise<Record<string, unknown>[]> {
    const collected: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    let token: string | undefined;
    do {
      const queryWithToken = token
        ? { ...query, pagination_token: token }
        : query;
      const page = await get(pathname, queryWithToken);
      collected.push(page);
      const meta = page.meta as { next_token?: string } | undefined;
      token = meta?.next_token;
      if (!token || seen.has(token)) break;
      seen.add(token);
    } while (token);
    return collected;
  }

  const tweetQuery = {
    "tweet.fields": TWEET_FIELDS,
    expansions: EXPANSIONS,
    "user.fields": USER_FIELDS,
    "media.fields": MEDIA_FIELDS,
  };

  return {
    async userId(): Promise<string> {
      const me = await get("/2/users/me", {});
      const id = (me.data as { id?: unknown } | undefined)?.id;
      if (typeof id !== "string") {
        throw new Error("GET /2/users/me did not return a user id");
      }
      return id;
    },

    async flatBookmarks(userId: string): Promise<{
      tweets: ApiTweet[];
      includes: Includes;
    }> {
      const result = await pages(`/2/users/${userId}/bookmarks`, {
        max_results: "100",
        ...tweetQuery,
      });
      return {
        tweets: result.flatMap((page) => asTweets(page.data)),
        includes: mergeIncludes(
          result.map((page) => (page.includes as Includes) ?? {}),
        ),
      };
    },

    async folderBookmarks(userId: string): Promise<{
      tweets: ApiTweet[];
      includes: Includes;
    }> {
      const folderPages = await pages(
        `/2/users/${userId}/bookmarks/folders`,
        { max_results: "100" },
      );
      const folderIds = folderPages.flatMap((page) => postIds(page.data));
      const ids: string[] = [];
      for (const folderId of folderIds) {
        const contents = await pages(
          `/2/users/${userId}/bookmarks/folders/${encodeURIComponent(folderId)}`,
          { max_results: "100" },
        );
        ids.push(...contents.flatMap((page) => postIds(page.data)));
      }
      const uniqueIds = [...new Set(ids)];
      const tweets: ApiTweet[] = [];
      const includes: Includes[] = [];
      for (let index = 0; index < uniqueIds.length; index += 100) {
        const batch = uniqueIds.slice(index, index + 100);
        if (batch.length === 0) continue;
        const lookup = await get("/2/tweets", {
          ids: batch.join(","),
          ...tweetQuery,
        });
        tweets.push(...asTweets(lookup.data));
        if (lookup.includes) includes.push(lookup.includes as Includes);
      }
      const byId = new Map(tweets.map((tweet) => [tweet.id, tweet]));
      return {
        tweets: uniqueIds.flatMap((id) => {
          const tweet = byId.get(id);
          return tweet ? [tweet] : [];
        }),
        includes: mergeIncludes(includes),
      };
    },
  };
}
