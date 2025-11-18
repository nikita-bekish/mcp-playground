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
    // const result = await client.callTool({
    //   name: "echo",
    //   arguments: { text: "Hello from MCP client!" },
    // });
    // console.log("Echo result:", result.content);

    // const sumResponse = await client.callTool({
    //   name: "sum",
    //   arguments: { a: 10, b: 32 },
    // });
    // console.log("Sum response:", sumResponse.content);

    // const fetchResp = await client.callTool({
    //   name: "fetch_url",
    //   arguments: { url: "https://www.google.com", maxChars: 300 },
    // });
    // console.log("Fetch result:\n", fetchResp.content[0].text);

    // const taskCountResponse = await client.callTool({
    //   name: "get_task_count",
    //   arguments: {},
    // });
    // console.log("Task count result:", taskCountResponse.content);

    const userReposCountResponse = await client.callTool({
      name: "get_user_repos_count",
      arguments: {
        username: "nikita-bekish", // пример пользователя GitHub
      },
    });
    console.log("User repos count:", userReposCountResponse.content);

    // const tasksResponse = await client.callTool({
    //   name: "get_tasks",
    //   arguments: {
    //     limit: 3,
    //   },
    // });
    // console.log("Tasks list:\n", tasksResponse.content[0].text);

    // const specificTaskResponse = await client.callTool({
    //   name: "get_task",
    //   arguments: {
    //     id: 5, // запросим задачу с ID = 5
    //   },
    // });
    // console.log(
    //   "Specific task result:\n",
    //   specificTaskResponse.content[0].text
    // );

    // 2. Получение списка репозиториев
    // const userReposResponse = await client.callTool({
    //   name: "get_user_repos",
    //   arguments: {
    //     username: "nikita-bekish",
    //     limit: 3,
    //   },
    // });
    // console.log("User repos:\n", userReposResponse.content[0].text);

    // // 3. Информация о конкретном репозитории
    // const repoInfoResponse = await client.callTool({
    //   name: "get_repo_info",
    //   arguments: {
    //     owner: "microsoft",
    //     repo: "vscode",
    //   },
    // });
    // console.log("Repository info:\n", repoInfoResponse.content[0].text);

    const aiAnalysisResponse = await client.callTool({
      name: "analyze_repo_with_ai",
      arguments: {
        owner: "nikita-bekish",
        repo: "ai-challenge",
        focus: "architecture",
      },
    });
    console.log("AI Analysis:\n", aiAnalysisResponse.content[0].text);

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
