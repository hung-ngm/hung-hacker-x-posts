import { notFound } from "next/navigation";
import { StoryList } from "@/components/story-list";
import { loadPosts } from "@/load-posts";
import { pageCount, rankHot, renderedAt } from "@/rank";

export function generateStaticParams() {
  return Array.from({ length: pageCount(loadPosts().length) }, (_, index) => ({
    page: String(index + 1),
  }));
}

export const dynamicParams = false;

export default async function HotPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  const parsed = Number(page);
  const posts = loadPosts();
  if (!/^\d+$/.test(page) || parsed < 1 || parsed > pageCount(posts.length)) {
    notFound();
  }
  return (
    <StoryList
      posts={rankHot(posts, renderedAt)}
      page={parsed}
      more={(next) => `/?p=${next}`}
    />
  );
}
