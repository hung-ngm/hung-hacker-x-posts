import { z } from "zod";

export const imageSchema = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
});

export const quoteSchema = z.object({
  id: z.string(),
  authorUsername: z.string(),
  text: z.string(),
  images: z.array(imageSchema),
});

export const postSchema = z.object({
  id: z.string(),
  bookmarkedAt: z.string(),
  authorUsername: z.string(),
  text: z.string(),
  title: z.string(),
  url: z.string().nullable(),
  domain: z.string().nullable(),
  likes: z.number(),
  reposts: z.number(),
  quote: quoteSchema.nullable(),
  images: z.array(imageSchema),
});

export type Image = z.infer<typeof imageSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type Post = z.infer<typeof postSchema>;
