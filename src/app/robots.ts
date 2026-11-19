import type { MetadataRoute } from "next";
import { noindex } from "@/config";

export default function robots(): MetadataRoute.Robots {
  return noindex
    ? { rules: { userAgent: "*", disallow: "/" } }
    : { rules: { userAgent: "*", allow: "/" } };
}
