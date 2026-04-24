import { StructuredContent } from "./router.js";
import { YoutubeTranscript } from "youtube-transcript";

// 🔹 Main extractor
export async function youtubeExtract(url: string): Promise<StructuredContent> {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) throw new Error("Invalid YouTube URL");

    const { title, transcript } = await getVideoContent(videoId);

    const chunks = chunkText(transcript, 400);

    return {
      source: "youtube",
      title: `YouTube: ${title}`,
      metadata: {
        url,
        videoId,
        chunkCount: chunks.length
      },
      content: chunks.join("\n\n---CHUNK---\n\n")
    };

  } catch (error) {
    return {
      source: "youtube",
      title: `YouTube: ${url}`,
      metadata: {
        url,
        error: String(error)
      },
      content: `[Error: ${String(error)}]`
    };
  }
}

// 🔹 Extract video ID
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

// 🔹 Fetch title + transcript
async function getVideoContent(videoId: string): Promise<{
  title: string;
  transcript: string;
}> {
  let title = videoId;

  // ✅ Fetch title from oEmbed
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`;
    const res = await fetch(oembedUrl);

    if (res.ok) {
      const data = await res.json() as any;
      title = data.title;
    }
  } catch (err) {
    console.warn("oEmbed failed:", err);
  }

  // ✅ Fetch transcript
  let transcriptText = "";

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    transcriptText = transcript
      .map(item => item.text)
      .join(" ");
  } catch (err) {
    console.warn("Transcript fetch failed:", err);
    transcriptText = "[No transcript available]";
  }

  return {
    title,
    transcript: transcriptText
  };
}

// 🔹 Chunking function (LLM-safe)
function chunkText(text: string, maxWords = 400): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  let current: string[] = [];

  for (const word of words) {
    current.push(word);

    if (current.length >= maxWords) {
      chunks.push(current.join(" "));
      current = [];
    }
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}