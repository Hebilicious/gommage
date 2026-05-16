import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Gommage",
  description: "CI-first authorship policy tooling for keeping AI co-authors out of git history.",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "CLI", link: "/guide/cli" },
      { text: "CI", link: "/guide/ci" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Configuration", link: "/guide/configuration" },
          { text: "CLI", link: "/guide/cli" },
          { text: "CI and Automation", link: "/guide/ci" },
          { text: "Surfaces", link: "/guide/surfaces" },
        ],
      },
    ],
  },
});
