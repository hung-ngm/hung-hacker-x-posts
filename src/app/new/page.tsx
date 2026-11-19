import { StoryList } from "@/components/story-list";
import { loadPosts } from "@/load-posts";

export default function NewPage() {
  return <StoryList posts={loadPosts()} page={1} more={(page) => `/new?p=${page}`} />;
}
