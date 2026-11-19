import { notFound } from "next/navigation";
import { StoryList } from "@/components/story-list";
import { loadPosts } from "@/load-posts";
import type { Post } from "@/post";

export function generateStaticParams() {
  return sites(loadPosts()).map((site) => ({ site }));
}

export const dynamicParams = false;

export default async function FromSitePage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site } = await params;
  const posts = postsFrom(loadPosts(), site);
  if (posts.length === 0) notFound();
  return (
    <StoryList
      posts={posts}
      page={1}
      more={(page) => `/from?site=${encodeURIComponent(site)}&p=${page}`}
    />
  );
}

function sites(posts: Post[]): string[] {
  return [
    ...new Set(posts.flatMap((post) => (post.domain ? [post.domain] : []))),
  ];
}

function postsFrom(posts: Post[], site: string): Post[] {
  const domain = decodeURIComponent(site);
  return posts.filter((post) => post.domain === domain);
}
