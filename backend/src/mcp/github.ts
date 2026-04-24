import { StructuredContent } from "./router.ts";

export async function githubExtract(url: string): Promise<StructuredContent> {
  // TODO: Real implementation: use GitHub API
  return {
    source: "github",
    title: `GitHub: ${url.split("/").slice(-2).join("/")}`,
    metadata: { url },
    content: `[GitHub repo/PR from ${url} - content extraction pending]`
  };
}
