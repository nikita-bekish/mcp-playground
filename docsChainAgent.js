import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "./client.js";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runDocsChain(userQuery) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const serverPath = path.resolve(__dirname, "docsServer.js");
  const { client, transport } = await createClient(serverPath);

  const { tools } = await client.listTools();

  const openaiTools = tools.map((t) => ({
    type: "function",
    name: t.name,
    description: t.description,
    parameters: t.inputSchema,
  }));

  // ВОТ ПРАВИЛЬНОЕ ОБЪЯВЛЕНИЕ
  let context = [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: `Ты — агент. 
Если пользователь просит сделать summary или обработать документ — 
ПОСЛЕ summarize_doc ОБЯЗАТЕЛЬНО вызови save_to_file 
с результатом. 
Не отвечай финальным текстом, пока не вызвал все инструменты по цепочке.
`,
        },
      ],
    },
    {
      role: "user",
      content: [{ type: "input_text", text: userQuery }],
    },
  ];

  while (true) {
    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: context,
      tools: openaiTools,
    });

    const output = response.output[0];
    console.log("nik LLM output:", output);

    if (output.type === "function_call") {
      const toolName = output.name;
      const raw = output.arguments || "{}";
      const args = typeof raw === "string" ? JSON.parse(raw) : raw;

      console.log(`→ calling MCP tool: ${toolName}`, args);

      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });

      const toolResponseText =
        result?.content?.[0]?.text ?? JSON.stringify(result, null, 2);

      context.push({
        role: "assistant",
        content: [
          {
            type: "output_text",
            tool_call_id: output.call_id,
            text: toolResponseText,
          },
        ],
      });

      if (toolName === "save_to_file") {
        console.log("Chain completed successfully.");
        break;
      }

      continue;
    }

    // --- финальный ответ ---
    if (output.type === "message") {
      // console.log("Final answer:", output.content[0].text);
      // break;
      const text = output.content?.[0]?.text ?? "";

      // ЕСЛИ ассистент дает "финальный ответ" — break
      // но если ассистент *просит выполнить действие* — НЕ break
      const isFinal =
        !text.includes("save") &&
        !text.includes("file") &&
        !text.includes("сохран") &&
        !text.includes("запис") &&
        !text.includes("далее");

      if (isFinal) {
        console.log("Final answer:", text);
        break;
      }

      // Добавляем в контекст и продолжаем
      context.push(output);
      continue;
    }
  }

  await client.close();
  transport.close();
}
