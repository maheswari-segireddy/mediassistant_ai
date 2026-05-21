const dotenv = require("dotenv");
dotenv.config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No API key found in backend/.env");
    process.exit(1);
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.models) {
      console.log("Available models:");
      data.models.forEach(m => console.log(m.name));
    } else {
      console.log("Response:", data);
    }
  } catch(e) {
    console.error("Error fetching models:", e);
  }
}

listModels();
