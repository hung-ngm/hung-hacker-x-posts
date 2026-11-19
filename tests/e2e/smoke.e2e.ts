import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Post } from "../../src/post";

const posts = JSON.parse(readFileSync("data/posts.json", "utf8")) as Post[];
const pageSize = 30;

test("lists, an item, and a site render rows", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Hung Hacker X Posts" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.locator("tr.athing")).toHaveCount(Math.min(pageSize, posts.length));
  const firstTitle = (
    await page.locator("tr.athing .titleline > a").first().innerText()
  ).trim();
  expect(posts.some((post) => post.title === firstTitle)).toBe(true);
  await expect(page.locator("a", { hasText: "discuss" })).toHaveCount(
    Math.min(pageSize, posts.length),
  );
  const bar = await page
    .locator("#hnmain td")
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(bar).toBe("rgb(255, 102, 0)");
  await page.screenshot({
    path: "/opt/cursor/artifacts/home.png",
    fullPage: true,
  });

  await page.goto("/new");
  await expect(page.locator("tr.athing")).toHaveCount(Math.min(pageSize, posts.length));
  await expect(page.locator(".subtext").first()).toContainText("points by @");
  await expect(page.locator(".subtext").first()).toContainText("discuss");

  const article = posts.find((post) => post.title === "Studios over Factories");
  if (!article) throw new Error("seed is missing the article post");
  await page.goto(`/item?id=${article.id}`);
  await expect(page.getByRole("link", { name: "open on X" })).toBeVisible();
  await expect(page.locator(".comment")).toContainText("Mumbling");

  const book = posts.find((post) => post.text.includes("Read the book online"));
  if (!book) throw new Error("seed is missing the book post");
  await page.goto(`/item?id=${book.id}`);
  await expect(page.locator(".comment")).toContainText("Read the book online");
  await expect(page.locator("img")).toBeVisible();
  await page.screenshot({
    path: "/opt/cursor/artifacts/item.png",
    fullPage: true,
  });

  const linked = posts.find((post) => post.domain);
  if (!linked?.domain) throw new Error("seed is missing a domain");
  await page.goto(`/from?site=${encodeURIComponent(linked.domain)}`);
  await expect(page.locator("tr.athing")).toHaveCount(
    Math.min(pageSize, posts.filter((post) => post.domain === linked.domain).length),
  );
  await expect(page.locator("tr.athing a").first()).toBeVisible();
});
