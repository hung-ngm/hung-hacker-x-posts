import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "query", key: "p", value: "(?<page>\\d+)" }],
          destination: "/hot/:page",
        },
        {
          source: "/new",
          has: [{ type: "query", key: "p", value: "(?<page>\\d+)" }],
          destination: "/new/:page",
        },
        {
          source: "/item",
          has: [{ type: "query", key: "id", value: "(?<id>\\d+)" }],
          destination: "/item/:id",
        },
        {
          source: "/from",
          has: [
            { type: "query", key: "site", value: "(?<site>[^&]+)" },
            { type: "query", key: "p", value: "(?<page>\\d+)" },
          ],
          destination: "/from/:site/:page",
        },
        {
          source: "/from",
          has: [{ type: "query", key: "site", value: "(?<site>[^&]+)" }],
          destination: "/from/:site",
        },
      ],
    };
  },
};

export default nextConfig;
