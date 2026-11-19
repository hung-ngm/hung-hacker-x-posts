import Link from "next/link";
import type { Image, Post } from "@/post";
import { pointsLabel, relativeTime, renderedAt } from "@/rank";

export function ItemView({ post }: { post: Post }) {
  return (
    <table className="border-collapse">
      <tbody>
        <tr className="athing" id={post.id}>
          <td className="title">
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
          <td className="subtext">
            <span className="score">{pointsLabel(post.likes)}</span>
            {" by "}
            <a href={`https://x.com/${post.authorUsername}`}>@{post.authorUsername}</a>{" "}
            {relativeTime(post.bookmarkedAt, renderedAt)}
            {" | "}
            <a href={`https://x.com/${post.authorUsername}/status/${post.id}`}>open on X</a>
          </td>
        </tr>
        <tr className="h-2" />
        <tr>
          <td>
            <RichText text={post.text} />
            <Images images={post.images} />
            {post.quote ? (
              <div className="my-2 border-l-2 border-[#ff6600] pl-2">
                <div className="subtext">
                  <a href={`https://x.com/${post.quote.authorUsername}/status/${post.quote.id}`}>
                    @{post.quote.authorUsername}
                  </a>
                </div>
                <RichText text={post.quote.text} />
                <Images images={post.quote.images} />
              </div>
            ) : null}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <div className="comment">
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part} rel="noreferrer">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </div>
  );
}

function Images({ images }: { images: Image[] }) {
  return images.map((image) => (
    // Tweet images are remote and already sized by the API. Skip the optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={image.url}
      src={image.url}
      alt=""
      width={image.width || undefined}
      height={image.height || undefined}
      className="my-2 block h-auto max-w-[500px]"
    />
  ));
}
