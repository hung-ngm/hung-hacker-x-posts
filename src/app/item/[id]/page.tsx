import { notFound } from "next/navigation";
import { ItemView } from "@/components/item-view";
import { loadPosts } from "@/load-posts";

export function generateStaticParams() {
  return loadPosts().map((post) => ({ id: post.id }));
}

export const dynamicParams = false;

export default async function ItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = loadPosts().find((item) => item.id === id);
  if (!post) notFound();
  return <ItemView post={post} />;
}
