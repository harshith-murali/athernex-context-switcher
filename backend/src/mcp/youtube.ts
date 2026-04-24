import { StructuredContent } from "./router.js";

export async function youtubeExtract(url: string): Promise<StructuredContent> {
  console.log("🎥 [YouTube] Starting extraction for URL:", url);
  try {
    const videoId = extractVideoId(url);
    console.log("🎥 [YouTube] Extracted videoId:", videoId);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    console.log("🎥 [YouTube] Fetching video metadata and description");
    const { title, description } = await getVideoMetadata(videoId);
    console.log("🎥 [YouTube] Video title:", title);

    const result: StructuredContent = {
      source: "youtube" as const,
      title: `YouTube: ${title}`,
      metadata: { url, videoId },
      content: description
    };
    console.log("🎥 [YouTube] Successfully extracted, content length:", description.length);
    return result;
  } catch (error) {
    console.error("❌ [YouTube] Error during extraction:", error);
    const result: StructuredContent = {
      source: "youtube" as const,
      title: `YouTube: ${url.split("/").pop()}`,
      metadata: { url, error: String(error) },
      content: `[Error fetching content: ${String(error)}]`
    };
    return result;
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getVideoMetadata(videoId: string): Promise<{
  title: string;
  description: string;
}> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`;
    console.log("🎥 [Metadata] Fetching from oEmbed:", oembedUrl);
    const response = await fetch(oembedUrl);
    console.log("🎥 [Metadata] oEmbed response status:", response.status);
    if (response.ok) {
      const data = await response.json() as any;
      console.log("🎥 [Metadata] Retrieved title:", data.title);
      return {
        title: data.title,
        description: data.title
      };
    }
  } catch (err) {
    console.warn("🎥 [Metadata] oEmbed fetch failed:", err);
  }

  console.log("🎥 [Metadata] Using videoId as fallback");
  return {
    title: videoId,
    description: `YouTube video: ${videoId}`
  };
}