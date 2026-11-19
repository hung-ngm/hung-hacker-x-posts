import { StoryList } from "@/components/story-list";
import { loadPosts } from "@/load-posts";
import { rankHot, renderedAt } from "@/rank";

export default function HomePage() {
  return (
    <StoryList
      posts={rankHot(loadPosts(), renderedAt)}
      page={1}
      more={(page) => `/?p=${page}`}
    />
  );
}
