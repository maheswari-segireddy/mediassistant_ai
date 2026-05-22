import { GoogleGenerativeAI } from "@google/generative-ai";

function convertMessagesToGemini(messages) {
  return messages.map((msg) => {
    const role = msg.role === "assistant" ? "model" : "user";
    let parts = [];

    if (typeof msg.content === "string") {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      msg.content.forEach((part) => {
        if (part.type === "text") {
          parts.push({ text: part.text });
        } else if (part.type === "image") {
          parts.push({
            inlineData: {
              mimeType: part.source.media_type,
              data: part.source.data,
            },
          });
        }
      });
    }

    return { role, parts };
  });
}

// Maximum execution time for Vercel Hobby tier is 10s (standard is 10s-60s)
export const maxDuration = 60;

export default async function handler(req, res) {
  // Handle CORS for local testing
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    return res.status(400).json({
      error: "Missing API Key",
      message: "⚠️ Google Gemini API Key is missing. Please add GEMINI_API_KEY to your Vercel Environment Variables.",
    });
  }

  const { messages, system } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      error: "Invalid Request",
      message: "The request body must contain a messages array.",
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: system || "You are MediAssist AI — a compassionate medical assistant.",
    });

    const formattedContents = convertMessagesToGemini(messages);

    const result = await model.generateContent({
      contents: formattedContents,
    });

    const responseText = result.response.text();

    return res.status(200).json({
      choices: [
        {
          message: {
            role: "assistant",
            content: responseText,
          },
        },
      ],
    });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(500).json({
      error: "AI Generation Error",
      message: error.message || "An unexpected error occurred while communicating with the Gemini API.",
    });
  }
}
