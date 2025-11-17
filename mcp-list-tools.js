import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["./mcp-server.js"],
  });

  const client = new Client({
    name: "tool-lister-client",
    version: "1.0.0",
  });

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();

    console.log("=== MCP tools from server ===\n");

    if (!tools || tools.length === 0) {
      console.log("No tools exposed by the server.");
    } else {
      for (const tool of tools) {
        console.log(`• name: ${tool.name}`);
        console.log(`  description: ${tool.description || "(no description)"}`);

        if (tool.inputSchema) {
          console.log(
            "  inputSchema:",
            JSON.stringify(tool.inputSchema, null, 2)
          );
        }

        console.log(""); // пустая строка между тулзами
      }
    }

    // (опционально) — пример вызова инструмента echo:
    const result = await client.callTool({
      name: "echo",
      arguments: { text: "Hello from MCP client!" },
    });
    console.log("Echo result:", result.content);

    await client.close();

    if (typeof transport.close === "function") {
      await transport.close();
    }
  } catch (error) {
    console.error("Failed to list MCP tools:", error);
    process.exit(1);
  }
}

main();
