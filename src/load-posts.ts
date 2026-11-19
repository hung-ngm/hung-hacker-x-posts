import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { postSchema, type Post } from "@/post";

const hiddenSchema = z.array(z.string());

export function postsPath(dir = path.join(process.cwd(), "data")): string {
  return path.join(dir, "posts.json");
}

export function readPosts(dir = path.join(process.cwd(), "data")): Post[] {
  const file = postsPath(dir);
  if (!existsSync(file)) return [];
  return z.array(postSchema).parse(JSON.parse(readFileSync(file, "utf8")));
}

export function readHidden(dir = path.join(process.cwd(), "data")): string[] {
  const file = path.join(dir, "hidden.json");
  if (!existsSync(file)) return [];
  return hiddenSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

export function loadPosts(dir = path.join(process.cwd(), "data")): Post[] {
  const hidden = new Set(readHidden(dir));
  return readPosts(dir).filter((post) => !hidden.has(post.id));
}
