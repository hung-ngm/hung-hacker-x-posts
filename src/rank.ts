import type { Post } from "@/post";

export const PAGE_SIZE = 30;

export const renderedAt = Date.now();

const HN_GRAVITY = 1.8;

export function hotScore(post: Post, now: number): number {
  const points = post.likes + post.reposts;
  const bookmarked = Date.parse(post.bookmarkedAt);
  const hours = Number.isFinite(bookmarked)
    ? Math.max(0, now - bookmarked) / 3_600_000
    : 0;
  return (points - 1) / (hours + 2) ** HN_GRAVITY;
}

export function rankHot(posts: Post[], now = Date.now()): Post[] {
  return [...posts].sort((a, b) => {
    const delta = hotScore(b, now) - hotScore(a, now);
    if (delta !== 0) return delta;
    if (a.bookmarkedAt !== b.bookmarkedAt) {
      return a.bookmarkedAt < b.bookmarkedAt ? 1 : -1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function pageSlice<T>(items: T[], page: number): {
  items: T[];
  page: number;
  hasMore: boolean;
} {
  const current = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const start = (current - 1) * PAGE_SIZE;
  return {
    items: items.slice(start, start + PAGE_SIZE),
    page: current,
    hasMore: start + PAGE_SIZE < items.length,
  };
}

export function pointsLabel(likes: number): string {
  return `${likes} point${likes === 1 ? "" : "s"}`;
}

export function relativeTime(iso: string, now: number): string {
  const then = Date.parse(iso);
  const seconds = Number.isFinite(then)
    ? Math.max(0, Math.floor((now - then) / 1000))
    : 0;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return "just now";
  if (minutes < 60) return plural(minutes, "minute");
  if (hours < 24) return plural(hours, "hour");
  const months = Math.floor(days / 30);
  if (months < 1) return plural(days, "day");
  if (months < 12) return plural(months, "month");
  return plural(Math.floor(days / 365), "year");
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}
