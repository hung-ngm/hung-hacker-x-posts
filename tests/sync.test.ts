import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
import { loadPosts, readPosts } from "../src/load-posts";
import type { Post } from "../src/post";
import { pageSlice, rankHot } from "../src/rank";
import { excerpt, serializePosts, syncBookmarks } from "../src/sync";
import { createXClient, oauthSignature, type ApiTweet } from "../src/x";

const fixture = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../fixtures/bookmarks.json", import.meta.url)),
    "utf8",
  ),
) as {
  data: ApiTweet[];
  includes: {
    users?: { id: string; username?: string }[];
    media?: [];
    tweets?: ApiTweet[];
  };
};

const now = new Date("2026-11-19T19:00:00.000Z");
const later = new Date("2026-11-20T19:00:00.000Z");

function sync(
  existing: Post[],
  at = now,
  fetchTitle: (url: string) => Promise<string | null> = async () => "Fetched Title",
  folderTweets?: ApiTweet[],
) {
  return syncBookmarks({
    existing,
    now: at,
    flatTweets: fixture.data,
    flatIncludes: fixture.includes,
    folderTweets,
    folderIncludes: folderTweets
      ? { users: [{ id: "1", username: "folderuser" }] }
      : undefined,
    fetchTitle,
  });
}

function assertListOrder(posts: Post[], ids: string[]) {
  const byId = new Map(posts.map((post) => [post.id, post]));
  for (let index = 1; index < ids.length; index++) {
    expect(Date.parse(byId.get(ids[index])!.bookmarkedAt)).toBeLessThan(
      Date.parse(byId.get(ids[index - 1])!.bookmarkedAt),
    );
  }
}

function loneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function blank(partial: Partial<Post> & Pick<Post, "id">): Post {
  return {
    bookmarkedAt: "2026-11-19T19:00:00.000Z",
    authorUsername: "someone",
    text: "text",
    title: "title",
    url: null,
    domain: null,
    likes: 0,
    reposts: 0,
    quote: null,
    images: [],
    ...partial,
  };
}

describe("sync", () => {
  test("derives titles from articles, fetched pages, and the opening text", async () => {
    const posts = await sync([], now, async () => "Fetched Title");
    const byId = new Map(posts.map((post) => [post.id, post]));

    const article = byId.get("2122706379987165590");
    expect(article?.title).toBe("Studios over Factories");
    expect(article?.domain).toBeNull();
    expect(article?.url).toContain("/i/article/");

    const linked = byId.get("2123042214779777389");
    expect(linked?.title).toBe("Fetched Title");
    expect(linked?.domain).toBe("studio.motionsites.ai");
    expect(linked?.url).toContain("studio.motionsites.ai");

    const plain = byId.get("2123318031199941055");
    expect(plain?.url).toBeNull();
    expect(plain?.domain).toBeNull();
    expect(plain?.title.startsWith("Hiring news for my builder friends")).toBe(true);
    expect(plain?.title.endsWith("…")).toBe(true);
    const graphemes = [
      ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
        plain?.title ?? "",
      ),
    ];
    expect(graphemes.length).toBeLessThanOrEqual(81);

    const missed = await sync([], now, async () => null);
    const fallback = missed.find((post) => post.id === "2123042214779777389");
    expect(fallback?.title.startsWith("If you design with AI")).toBe(true);
    expect(fallback?.domain).toBe("studio.motionsites.ai");
    expect(fallback?.title).not.toBe("Fetched Title");
  });

  test("keeps an emoji that sits on the title cut", () => {
    const party = excerpt(`${"a".repeat(79)}🎉 and more after the cut`);
    expect(party).toBe(`${"a".repeat(79)}🎉…`);
    expect(loneSurrogate(party)).toBe(false);

    const family = excerpt(`${"b".repeat(79)}👨‍👩‍👧 and more after the cut`);
    expect(family).toBe(`${"b".repeat(79)}👨‍👩‍👧…`);
    expect(loneSurrogate(family)).toBe(false);
  });

  test("stored titles contain no lone surrogates", () => {
    const posts = JSON.parse(
      readFileSync(fileURLToPath(new URL("../data/posts.json", import.meta.url)), "utf8"),
    ) as { title: string }[];
    expect(posts.every((post) => !loneSurrogate(post.title))).toBe(true);
  });

  test("keeps the full note, quote, image, and decoded text", async () => {
    const posts = await sync([]);
    const byId = new Map(posts.map((post) => [post.id, post]));
    const hiring = byId.get("2123318031199941055");
    expect(hiring?.quote?.authorUsername).toBe("shafu0x");
    expect(hiring?.quote?.text).toContain("Agentic Commerce");

    const book = byId.get("2123046064290779454");
    expect(book?.text).toContain("Read the book online");
    expect(book?.text).toContain("chapterpal.com");
    expect(book?.images[0]?.url).toContain("pbs.twimg.com");

    const robotics = byId.get("2122792820964495543");
    expect(robotics?.text).toContain("world models & robot hands");
    expect(robotics?.text).not.toContain("&amp;");
  });

  test("merge is append-only, refreshes metrics, and is byte-identical on replay", async () => {
    let calls = 0;
    const fetchTitle = async () => {
      calls += 1;
      return "Fetched Title";
    };
    const first = await sync([], now, fetchTitle);
    const callsAfterFirst = calls;
    const replay = await sync(first, later, fetchTitle);
    expect(serializePosts(replay)).toBe(serializePosts(first));
    expect(calls).toBe(callsAfterFirst);

    const kept = blank({
      id: "424242",
      title: "kept post",
      bookmarkedAt: "2020-01-01T00:00:00.000Z",
      likes: 5,
    });
    const withKept = await sync([kept, ...first], later, fetchTitle);
    expect(withKept.find((post) => post.id === "424242")?.title).toBe("kept post");
    expect(serializePosts(withKept)).toContain('"id": "424242"');

    const target = "2123133742063706343";
    const apiLikes = fixture.data.find((tweet) => tweet.id === target)?.public_metrics
      ?.like_count;
    const seeded = first.map((post) =>
      post.id === target ? { ...post, likes: 1, title: "original title" } : post,
    );
    const refreshed = await sync(seeded, later, fetchTitle);
    const updated = refreshed.find((post) => post.id === target);
    expect(updated?.likes).toBe(apiLikes);
    expect(updated?.title).toBe("original title");
    expect(updated?.bookmarkedAt).toBe(
      seeded.find((post) => post.id === target)?.bookmarkedAt,
    );

    const ids = fixture.data.map((tweet) => tweet.id);
    const byId = new Map(first.map((post) => [post.id, post]));
    for (let index = 1; index < ids.length; index++) {
      expect(Date.parse(byId.get(ids[index])!.bookmarkedAt)).toBeLessThan(
        Date.parse(byId.get(ids[index - 1])!.bookmarkedAt),
      );
    }
  });

  test("places unseen flat-list posts by their neighbors", async () => {
    const first = await sync([]);
    const ids = fixture.data.map((tweet) => tweet.id);
    const top = first.filter((post) => ids.slice(0, 2).includes(post.id));
    const tail = first.filter((post) => !ids.slice(0, 2).includes(post.id));

    const below = await sync(top, later);
    const oldestTop = Math.min(...top.map((post) => Date.parse(post.bookmarkedAt)));
    for (const post of below) {
      if (ids.slice(0, 2).includes(post.id)) {
        expect(post.bookmarkedAt).toBe(top.find((item) => item.id === post.id)?.bookmarkedAt);
      } else {
        expect(Date.parse(post.bookmarkedAt)).toBeLessThan(oldestTop);
      }
    }
    assertListOrder(below, ids);
    const replay = await sync(below, later);
    expect(serializePosts(replay)).toBe(serializePosts(below));

    const above = await sync(tail, later);
    const newestTail = Math.max(...tail.map((post) => Date.parse(post.bookmarkedAt)));
    for (const id of ids.slice(0, 2)) {
      expect(Date.parse(above.find((post) => post.id === id)!.bookmarkedAt)).toBeGreaterThan(
        newestTail,
      );
    }
    assertListOrder(above, ids);
  });

  test("backfill keeps folder posts that the next daily sync does not return", async () => {
    const extra: ApiTweet = {
      id: "999000111",
      text: "Folder only bookmark about compilers",
      author_id: "1",
      public_metrics: { like_count: 3, retweet_count: 1 },
    };
    const backfill = await sync([], now, async () => null, [extra]);
    const folderPost = backfill.find((post) => post.id === extra.id);
    expect(folderPost?.authorUsername).toBe("folderuser");
    expect(folderPost?.title).toBe("Folder only bookmark about compilers");
    const oldestFlat = Math.min(
      ...backfill
        .filter((post) => post.id !== extra.id)
        .map((post) => Date.parse(post.bookmarkedAt)),
    );
    expect(Date.parse(folderPost!.bookmarkedAt)).toBeLessThan(oldestFlat);

    const daily = await sync(backfill, later, async () => null);
    expect(daily.some((post) => post.id === extra.id)).toBe(true);
    expect(serializePosts(daily)).toBe(serializePosts(backfill));
  });

  test("loadPosts hides ids without dropping them from the file", async () => {
    const posts = await sync([]);
    const dir = mkdtempSync(path.join(tmpdir(), "hhxp-"));
    writeFileSync(path.join(dir, "posts.json"), serializePosts(posts));
    writeFileSync(path.join(dir, "hidden.json"), JSON.stringify([posts[0].id]));
    const visible = loadPosts(dir);
    expect(visible.some((post) => post.id === posts[0].id)).toBe(false);
    expect(visible).toHaveLength(posts.length - 1);
    expect(readPosts(dir)).toHaveLength(posts.length);
    const ranked = rankHot(visible, now.getTime()).map((post) => post.id);
    expect(ranked).not.toContain(posts[0].id);
  });
});

describe("hot ranking", () => {
  test("orders likes plus reposts by Hacker News gravity from bookmarkedAt", () => {
    const at = Date.parse("2026-11-19T19:00:00.000Z");
    const low = blank({ id: "a", likes: 10, reposts: 0 });
    const high = blank({ id: "b", likes: 0, reposts: 50 });
    expect(rankHot([low, high], at).map((post) => post.id)).toEqual(["b", "a"]);

    const fresh = blank({
      id: "c",
      likes: 3,
      bookmarkedAt: "2026-11-19T19:00:00.000Z",
    });
    const old = blank({
      id: "d",
      likes: 100,
      bookmarkedAt: "2026-11-18T19:00:00.000Z",
    });
    expect(rankHot([old, fresh], at).map((post) => post.id)).toEqual(["c", "d"]);

    const tieA = blank({ id: "2", likes: 5 });
    const tieB = blank({ id: "1", likes: 5 });
    expect(rankHot([tieA, tieB], at).map((post) => post.id)).toEqual(["1", "2"]);
  });

  test("pages 30 rows at a time", () => {
    const items = Array.from({ length: 31 }, (_, index) => index);
    expect(pageSlice(items, 1)).toEqual({
      items: items.slice(0, 30),
      page: 1,
      hasMore: true,
    });
    expect(pageSlice(items, 2)).toEqual({
      items: [30],
      page: 2,
      hasMore: false,
    });
  });
});

describe("x api", () => {
  test("oauth signature matches the published example", () => {
    const signature = oauthSignature({
      method: "POST",
      url: "https://api.twitter.com/1.1/statuses/update.json",
      query: {
        include_entities: "true",
        status: "Hello Ladies + Gentlemen, a signed OAuth request!",
      },
      consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
      tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
      oauth: {
        oauth_consumer_key: "xvz1evFS4wEEPTGEFPHBog",
        oauth_nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: "1318622958",
        oauth_token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
        oauth_version: "1.0",
      },
    });
    expect(signature).toBe("hCtSmYh+iHYCEqBWrE7C7hYmtUk=");
  });

  test("pages the flat list and hydrates folder ids", async () => {
    const urls: string[] = [];
    const client = createXClient(
      {
        apiKey: "key",
        apiSecret: "secret",
        accessToken: "token",
        accessTokenSecret: "token-secret",
      },
      async (input, init) => {
        expect(init?.headers?.Authorization).toContain("OAuth ");
        urls.push(input);
        if (input.includes("/bookmarks/folders/")) {
          return Response.json({ data: ["7"] });
        }
        if (input.includes("/bookmarks/folders")) {
          return Response.json({ data: [{ id: "fold" }] });
        }
        if (input.includes("/2/tweets?")) {
          return Response.json({
            data: [{ id: "7", text: "hydrated", public_metrics: { like_count: 4, retweet_count: 0 } }],
          });
        }
        if (input.includes("pagination_token")) {
          return Response.json({ data: [{ id: "2", text: "second" }] });
        }
        if (input.includes("/bookmarks")) {
          return Response.json({
            data: [{ id: "1", text: "first" }],
            meta: { next_token: "NEXT" },
          });
        }
        return Response.json({ data: { id: "42" } });
      },
    );

    expect(await client.userId()).toBe("42");
    const flat = await client.flatBookmarks("42");
    expect(flat.tweets.map((tweet) => tweet.id)).toEqual(["1", "2"]);
    expect(urls.some((url) => url.includes("pagination_token=NEXT"))).toBe(true);
    expect(urls.some((url) => url.includes("tweet.fields="))).toBe(true);

    const folders = await client.folderBookmarks("42");
    expect(folders.tweets.map((tweet) => tweet.id)).toEqual(["7"]);
    expect(urls.some((url) => url.includes("/2/tweets?"))).toBe(true);
  });
});
