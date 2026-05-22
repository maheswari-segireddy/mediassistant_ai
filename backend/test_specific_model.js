const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

async function testModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("API Key missing!");
    return;
  }
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });
    
    console.log("Calling gemini-2.0-flash...");
    const result = await model.generateContent("Say hello!");
    console.log("Success! Response:", result.response.text());
  } catch (e) {
    console.error("Failed to run gemini-2.0-flash:", e);
  }
}

testModel();
