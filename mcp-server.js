import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";

const server = new McpServer({
  name: "echo-server",
  version: "1.0.0",
});

server.registerTool(
  "echo",
  {
    description: "Echo back the provided text",
    inputSchema: {
      text: z
        .string()
        .min(1, "Text cannot be empty")
        .describe("Text to echo back"),
    },
  },
  async ({ text }) => {
    return {
      content: [
        {
          type: "text",
          text: text,
        },
      ],
    };
  }
);

server.registerTool(
  "sum",
  {
    description: "Calculate the sum of two numbers",
    inputSchema: {
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    },
  },
  async ({ a, b }) => {
    const result = a + b;

    return {
      content: [
        {
          type: "text",
          text: `${a} + ${b} = ${result}`,
        },
      ],
    };
  }
);

server.registerTool(
  "fetch_url",
  {
    description: "Fetch content from a given URL",
    inputSchema: {
      url: z.string().url().describe("The URL to fetch content from"),
      maxChars: z
        .number()
        .optional()
        .default(500)
        .describe("Max number of characters to include in response"),
    },
  },
  async ({ url, maxChars }) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "MCP-Fetch-Tool/1.0",
        },
      });

      clearTimeout(timeout);

      const text = await response.text();
      const snippet = text.slice(0, maxChars);

      const formatted = [
        `URL: ${url}`,
        `Status: ${response.status} ${response.statusText}`,
        `--- HEADERS ---`,
        JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2),
        `--- BODY (first ${maxChars} chars) ---`,
        snippet,
        `--- END ---`,
      ].join(`\n`);

      return {
        content: [{ type: "text", text: formatted }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching URL ${url}:\n${err.message}`,
          },
        ],
      };
    }
  }
);

async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Логи MCP-сервера принято писать в stderr
    console.error("Echo MCP server listening on stdio");
  } catch (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }
}

main();
