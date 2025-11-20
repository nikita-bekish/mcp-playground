import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import { z } from "zod";
// import { zodToJsonSchema } from "zod-to-json-schema";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function normalize(str) {
  return str.toLowerCase().replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Улучшенный семантический поиск:
 * - разбивает запрос на слова
 * - ищет каждое слово в тексте документа
 * - допускает совпадение по частям ("mcp" найдётся в "protocol (mcp)")
 */
function smartSearch(query, documents) {
  const q = normalize(query);
  const keywords = q.split(/\s+/).filter((w) => w.length > 2); // игнорируем предлоги типа "про", "на", "и"

  const results = [];

  for (const [id, text] of Object.entries(documents)) {
    const t = normalize(text);

    // минимальный fuzzy-match: все ключевые слова должны встречаться
    const match = keywords.every((word) => t.includes(word));

    if (match) {
      results.push({ id, text });
    }
  }

  return results;
}

// ЛОГИ ТОЛЬКО В STDERR
// process.stderr.write("=== DOCS SERVER STARTED ===\n");
// process.stderr.write("SERVER START PHASE 1\n");

// -------------------------
//   MOCK DOCUMENT STORAGE
// -------------------------

const DOCUMENTS = {
  doc1: `
Model Context Protocol (MCP) — это открытый протокол, созданный для соединения LLM 
с внешними инструментами, такими как API, базы данных, поисковые системы, системы 
хранения файлов, сервисы планирования задач, и локальные утилиты. MCP решает 
ключевую проблему: модели не имеют доступа к внешнему миру, а MCP позволяет 
динамически предоставлять инструменты и ресурсы. В отличие от обычных REST API, 
MCP работает поверх STDIO или WebSockets, что делает его лёгким для встраивания 
в локальные агенты, редакторы, IDE и CI/CD системы. MCP инструменты объявляются 
прямо сервером и становятся доступными LLM автоматически.
`,
  doc2: `
Композиция инструментов MCP позволяет связать несколько независимых функций 
в единую цепочку рассуждений. Например: найти документы по ключевому слову, 
затем сгенерировать краткое описание найденных фрагментов, а затем сохранить 
результат в файл или отправить в API. Такой подход делает LLM полноценным 
оркестратором, который может выполнять сложные workflow. Важным преимуществом 
является то, что MCP стандартизирует входные и выходные данные, позволяя 
агенту работать с инструментами разных серверов, не ломаясь при изменении структуры.
`,
  doc3: `
Node.js является мощной средой для разработки MCP-серверов благодаря отличной 
поддержке асинхронных операций, потоков ввода/вывода и экосистеме NPM. MCP-сервер 
на Node.js может предоставлять инструменты для работы с файлами, сетевыми запросами, 
интеграцией с внешними API, анализом логов, запуском дочерних процессов, сбором 
данных, автоматизацией devops-задач. MCP хорошо масштабируется через микросервисы, 
так как инструменты могут быть распределены по нескольким серверам и объединены 
единым агентом. Благодаря zod-валидации можно жёстко типизировать входные данные 
инструментов и предотвращать ошибки на уровне протокола.
`,
};

// -------------------------
//   ZOD SCHEMAS
// -------------------------

const searchDocsSchema = z.object({
  query: z.string().min(1).describe("Search query"),
});

const summarizeSchema = z.object({
  text: z.string().min(1).describe("Text to summarize"),
});

const saveToFileSchema = z.object({
  filename: z.string().min(1).describe("Filename to save into"),
  content: z.string().min(1).describe("Content to save"),
});

// -------------------------
//   MCP SERVER
// -------------------------

const server = new McpServer({
  name: "docs-server",
  version: "1.0.0",
});

// --- search_docs ---
server.registerTool(
  "search_docs",
  {
    description: "Search documents by keyword",
    inputSchema: {
      query: z.string(),
    },
  },
  async ({ query }) => {
    const results = smartSearch(query, DOCUMENTS);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }
);

// --- summarize_doc ---
server.registerTool(
  "summarize_doc",
  {
    description: "Summarize text",
    inputSchema: {
      text: z.string(),
    },
  },
  async ({ text }) => {
    // const summary = text.slice(0, 100) + "...";
    // return { content: [{ type: "text", text: summary }] };
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "Ты — система резюмирования. Кратко, точно, структурировано, без воды. Дай 3–6 предложений.",
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text }],
        },
      ],
    });

    // Извлекаем текст ответа
    const summary = response.output_text;

    return {
      content: [
        {
          type: "text",
          text: summary,
        },
      ],
    };
  }
);

// --- save_to_file ---
server.registerTool(
  "save_to_file",
  {
    description: "Save content to a file",
    inputSchema: {
      filename: z.string(),
      content: z.string(),
    },
  },
  async ({ filename, content }) => {
    fs.writeFileSync(filename, content, "utf8");
    return {
      content: [{ type: "text", text: `Saved to ${filename}` }],
    };
  }
);

// -------------------------
//   START SERVER
// -------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
