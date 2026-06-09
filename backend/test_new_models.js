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
    "gemini-flash-lite-latest",
    "gemini-pro-latest",
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite"
  ];
  for (const m of models) {
    await testModel(m);
  }
}

run();
