import Link from "next/link";
import { loadPosts } from "@/load-posts";

export default function FromIndexPage() {
  const domains = [
    ...new Set(loadPosts().flatMap((post) => (post.domain ? [post.domain] : []))),
  ].sort();
  if (domains.length === 0) return <p className="text-black">No posts.</p>;
  return (
    <div className="text-[10pt] leading-[16pt] text-black">
      {domains.map((domain) => (
        <div key={domain}>
          <Link href={`/from?site=${encodeURIComponent(domain)}`}>{domain}</Link>
        </div>
      ))}
    </div>
  );
}
