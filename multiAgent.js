import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";
import { createMultiClient } from "./multiClient.js";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMultiFlow(userQuery) {
  // 1) создаём multi-client с двумя серверами
  const multi = await createMultiClient([
    {
      id: "docs",
      scriptPath: path.resolve(__dirname, "docsServer.js"),
    },
    {
      id: "reminder",
      scriptPath: path.resolve(__dirname, "reminderServer.js"),
    },
  ]);

  const toolForOpenAi = multi.getOpenAiTools();

  // 2) начальный контекст
  let context = [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: `
Ты — оркестратор MCP-инструментов.
Доступные группы:
- docs__*  — работа с документами (поиск, summary, сохранение)
- reminder__* — работа с напоминаниями

Пример разумного флоу:
1) docs__search_docs
2) docs__summarize_doc
3) docs__save_to_file
4) reminder__add_reminder (создать напоминание перечитать summary позже)

Запрещено повторно вызывать инструменты шагов 1 и 2. 
После получения результата от summarize немедленно переходи к шагу 3.
После вызова reminder — возвращай финальное сообщение.
Строго используй инструменты. В конце дай человеку короткий ответ, что ты сделал.
        `,
        },
      ],
    },
    {
      role: "user",
      content: [{ type: "input_text", text: userQuery }],
    },
  ];

  let steps = 0;
  const MAX_STEPS = 10;

  try {
    while (steps < MAX_STEPS) {
      steps++;

      const response = await openai.responses.create({
        model: "gpt-4.1",
        input: context,
        tools: toolForOpenAi,
      });

      const output = response.output[0];
      console.log("LLM output:", output);

      if (output.type === "message") {
        // финальный ответ
        console.log("Final answer:", output.content[0].text);
        break;
      }

      if (output.type === "function_call") {
        const fullToolName = output.name; // docs__search_docs или reminder__add_reminder
        const rawArgs = output.arguments || "{}";
        const args =
          typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;

        console.log(`→ calling MCP tool: ${fullToolName}`, args);

        const toolResult = await multi.callTool(fullToolName, args);
        const toolText = toolResult.content[0]?.text ?? "";

        // Добавляем результат вызова инструмента в контекст
        context.push({
          role: "assistant",
          content: [
            {
              type: "output_text",
              tool_call_id: output.call_id,
              text: toolText,
            },
          ],
        });

        continue;
      }
      console.log("Unexpected output type, breaking loop");
      break;
    }
  } catch (error) {
    console.error("Error during multi-agent flow:", error);
  } finally {
    await multi.closeAll();
  }
}
