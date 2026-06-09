const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

async function testModel(modelName) {
  const apiKey = process.env.GEMINI_API_KEY;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Say 'Active'!");
    console.log(`SUCCESS: ${modelName} ->`, result.response.text().trim());
    return true;
  } catch (e) {
    console.log(`FAILED: ${modelName} ->`, e.message);
    return false;
  }
}

async function run() {
  const models = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-flash-latest",
    "gemini-2.0-flash-exp",
    "gemini-2.5-flash",
    "gemini-2.5-pro"
  ];
  for (const m of models) {
    await testModel(m);
  }
}

run();
