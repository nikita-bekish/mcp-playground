// import dotenv from "dotenv";
// import OpenAI from "openai";
// import { createClient } from "./client.js";

// dotenv.config();

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// export async function askLLM(prompt) {
//   // подключаемся к MCP-серверу
//   const { client, transport } = await createClient("./reminderServer.js");

//   // берём tools у сервера
//   const { tools } = await client.listTools();

//   // конвертируем в формат OpenAI
//   // const formattedTools = tools.map((t) => ({
//   //   name: t.name,
//   //   description: t.description,
//   //   input_schema: t.inputSchema,
//   // }));
//   const openaiTools = tools.map((tool) => ({
//     type: "function",
//     name: tool.name,
//     description: tool.description || "",
//     input_schema: tool.inputSchema || {
//       type: "object",
//       properties: {},
//     },
//   }));

//   console.log("OpenAI tools:", openaiTools);

//   //   const response = await openai.responses.create({
//   //     model: "gpt-4.1",
//   //     input: prompt,
//   //     system: `
//   // Ты — планировщик задач.
//   // Если пользователь просит напомнить что-то, ты обязательно вызываешь инструмент add_reminder.
//   // Никогда не оставляй arguments пустыми.
//   // Заполняй:
//   // - arguments.text — что нужно напомнить
//   // - arguments.remindAt — точное ISO-время (например: 2025-01-29T12:45:00Z)
//   // Если невозможно определить время — уточни у пользователя.`,
//   //     tools: openaiTools,
//   //   });
//   const response = await openai.responses.create({
//     model: "gpt-4.1",
//     messages: [
//       {
//         role: "system",
//         content: `
// Ты — планировщик задач.
// Если пользователь просит напомнить что-то, ты обязательно вызываешь инструмент add_reminder.
// Никогда не оставляй arguments пустыми.
// Всегда заполняй:
// - text: что напомнить
// - remindAt: точное ISO-время.
// Если время указано в виде "через X минут" — вычисли ISO 8601 относительно текущего времени (${new Date().toISOString()}).
// `,
//       },
//       {
//         role: "user",
//         content: prompt,
//       },
//     ],
//     tools: openaiTools,
//   });

//   const output = response.output[0];
//   console.log("LLM output:", output);

//   if (output.type === "function_call") {
//     const name = output.name;

//     // arguments может быть и строкой, и объектом
//     const rawArgs = output.arguments;
//     let args = {};

//     if (typeof rawArgs === "string") {
//       try {
//         args = JSON.parse(rawArgs);
//       } catch (err) {
//         console.error("❌ Cannot parse tool arguments:", rawArgs);
//         args = {};
//       }
//     } else {
//       args = rawArgs || {};
//     }

//     console.log("LLM selected tool:", name, args);

//     const result = await client.callTool({
//       name,
//       arguments: args,
//     });

//     console.log("TOOL RESULT:", result.content[0].text);
//   } else {
//     console.log("LLM answer:", response.output_text);
//   }

//   await client.close();
//   transport.close();
// }

import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "./client.js";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function askLLM(inputText) {
  const { client, transport } = await createClient("./reminderServer.js");

  const { tools } = await client.listTools();

  const openaiTools = tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description || "",
    parameters: tool.inputSchema,
  }));

  const response = await openai.responses.create({
    model: "gpt-4.1",
    input: [
      {
        role: "system",
        content: `
Ты — планировщик задач.
Ты обязан использовать инструмент add_reminder если пользователь просит создать напоминание.
Заполняй:
- text: строка
- remindAt: ISO 8601 строка
Не оставляй arguments пустыми.
Если время указано как "через X минут", "через X часов", "через X секунд" — конвертируй относительно текущего момента: ${new Date().toISOString()}.
        `,
      },
      {
        role: "user",
        content: inputText,
      },
    ],
    tools: openaiTools,
  });

  const output = response.output[0];

  const name = output.name || output.tool_call?.name;

  let rawArgs = output.arguments || output.tool_call?.arguments || "{}";

  let args = {};

  try {
    if (typeof rawArgs === "string") {
      args = JSON.parse(rawArgs);
    } else {
      args = rawArgs;
    }
  } catch (e) {
    console.error("❌ cannot parse args", rawArgs);
  }

  // Если LLM дал пустые аргументы → повторяем запрос
  if (!args.text || !args.remindAt) {
    console.log("⚠️ LLM вернул пустые аргументы. Повторяем...");

    return await askLLM(`
Ты не вернул аргументы. Пользователь сказал: "${inputText}". 
Пожалуйста, верни valid tool_call с text и remindAt.
`);
  }

  console.log("LLM selected tool:", name, args);

  const result = await client.callTool({
    name,
    arguments: args,
  });

  console.log("TOOL RESULT:", result.content[0].text);

  transport.close();
  await client.close();
}
