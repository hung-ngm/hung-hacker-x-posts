import { notFound } from "next/navigation";
import { StoryList } from "@/components/story-list";
import { loadPosts } from "@/load-posts";
import type { Post } from "@/post";
import { pageCount } from "@/rank";

export function generateStaticParams() {
  const posts = loadPosts();
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (!post.domain) continue;
    counts.set(post.domain, (counts.get(post.domain) ?? 0) + 1);
  }
  return [...counts].flatMap(([site, count]) =>
    Array.from({ length: pageCount(count) }, (_, index) => ({
      site,
      page: String(index + 1),
    })),
  );
}

export const dynamicParams = false;

export default async function FromSitePaged({
  params,
}: {
  params: Promise<{ site: string; page: string }>;
}) {
  const { site, page } = await params;
  const parsed = Number(page);
  const posts = postsFrom(loadPosts(), site);
  if (
    posts.length === 0 ||
    !/^\d+$/.test(page) ||
    parsed < 1 ||
    parsed > pageCount(posts.length)
  ) {
    notFound();
  }
  return (
    <StoryList
      posts={posts}
      page={parsed}
      more={(next) => `/from?site=${encodeURIComponent(site)}&p=${next}`}
    />
  );
}

function postsFrom(posts: Post[], site: string): Post[] {
  const domain = decodeURIComponent(site);
  return posts.filter((post) => post.domain === domain);
}
