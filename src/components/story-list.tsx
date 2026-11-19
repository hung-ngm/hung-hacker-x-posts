import Link from "next/link";
import { Fragment } from "react";
import type { Post } from "@/post";
import { PAGE_SIZE, pageSlice, pointsLabel, relativeTime, renderedAt } from "@/rank";

export function StoryList({
  posts,
  page,
  more,
}: {
  posts: Post[];
  page: number;
  more: (page: number) => string;
}) {
  const slice = pageSlice(posts, page);
  if (posts.length === 0) {
    return <p className="text-black">No posts.</p>;
  }
  const rankStart = (slice.page - 1) * PAGE_SIZE;
  return (
    <table className="border-collapse">
      <tbody>
        {slice.items.map((post, index) => {
          return (
            <Fragment key={post.id}>
              <tr className="athing" id={post.id}>
                <td className="title pr-1 text-right align-top whitespace-nowrap">
                  <span className="rank">{rankStart + index + 1}.</span>
                </td>
                <td className="title align-top">
                  <span className="titleline">
                    {post.url ? (
                      <a href={post.url} rel="noreferrer">
                        {post.title}
                      </a>
                    ) : (
                      <Link href={`/item?id=${post.id}`}>{post.title}</Link>
                    )}
                    {post.domain ? (
                      <span className="comhead">
                        {" ("}
                        <Link href={`/from?site=${encodeURIComponent(post.domain)}`}>
                          <span className="sitestr">{post.domain}</span>
                        </Link>
                        )
                      </span>
                    ) : null}
                  </span>
                </td>
              </tr>
              <tr>
                <td />
                <td className="subtext">
                  <span className="score">{pointsLabel(post.likes)}</span>
                  {" by "}
                  <a href={`https://x.com/${post.authorUsername}`}>
                    @{post.authorUsername}
                  </a>{" "}
                  <Link href={`/item?id=${post.id}`}>
                    {relativeTime(post.bookmarkedAt, renderedAt)}
                  </Link>
                  {" | "}
                  <Link href={`/item?id=${post.id}`}>discuss</Link>
                </td>
              </tr>
              <tr className="h-[5px]" />
            </Fragment>
          );
        })}
        {slice.hasMore ? (
          <tr>
            <td colSpan={2} className="pt-[10px]">
              <Link href={more(slice.page + 1)} className="morelink" rel="next">
                More
              </Link>
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
