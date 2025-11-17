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
