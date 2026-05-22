const dotenv = require("dotenv");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

async function testModel(modelName) {
  const apiKey = process.env.GEMINI_API_KEY;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
    });
    
    console.log(`Testing ${modelName}...`);
    const result = await model.generateContent("Say 'Active'!");
    console.log(`SUCCESS on ${modelName}! Response:`, result.response.text());
    return true;
  } catch (e) {
    console.error(`FAILED on ${modelName}:`, e.message || e);
    return false;
  }
}

async function run() {
  const models = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.0-flash-lite",
    "gemini-pro-latest"
  ];
  
  for (const m of models) {
    const success = await testModel(m);
    if (success) {
      console.log(`\nFound working model: ${m}`);
      break;
    }
  }
}

run();
