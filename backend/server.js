const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS for frontend requests
app.use(cors());

// Support large JSON payloads (for base64 medical images)
app.use(express.json({ limit: "15mb" }));

// Helper to convert messages into Gemini SDK format
function convertMessagesToGemini(messages) {
  return messages.map((msg) => {
    // Gemini roles must be 'user' or 'model' (Anthropic uses 'assistant')
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

// API endpoint for chat completions
app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    return res.status(400).json({
      error: "Missing API Key",
      message:
        "⚠️ Google Gemini API Key is missing on the server. Please add your key to backend/.env file (e.g. GEMINI_API_KEY=your_key) and restart the server.",
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
    // Initialize the Gemini API client
    const genAI = new GoogleGenerativeAI(apiKey);

    // Use gemini-flash-latest for rapid, rich responses (supports multi-modal input and system instructions)
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: system || "You are MediAssist AI — a compassionate medical assistant.",
    });

    // Format message history
    const formattedContents = convertMessagesToGemini(messages);

    // Call Gemini API to generate response
    const result = await model.generateContent({
      contents: formattedContents,
    });

    const responseText = result.response.text();

    res.json({
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
    res.status(500).json({
      error: "AI Generation Error",
      message: error.message || "An unexpected error occurred while communicating with the Gemini API.",
    });
  }
});

app.listen(port, () => {
  console.log(`MediAssist backend running on http://localhost:${port}`);
});
