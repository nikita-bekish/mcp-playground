import { askLLM } from "./llmAgent.js";

// Берём аргументы из командной строки
const prompt = process.argv.slice(2).join(" ");

if (!prompt) {
  console.log("❗ Укажи текст. Например:");
  console.log('   node index.js "напомни через 1 минуту попить воды"');
  process.exit(0);
}

askLLM(prompt);
