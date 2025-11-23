import { createClient } from "./client.js";

export async function createMultiClient(configs) {
  const servers = [];
  const toolIndex = new Map();

  for (const cfg of configs) {
    const { client, transport } = await createClient(cfg.scriptPath);
    servers.push({ id: cfg.id, client, transport });

    const tools = await client.listTools();

    for (const t of tools.tools) {
      const fullName = `${cfg.id}__${t.name}`;

      toolIndex.set(fullName, {
        serverId: cfg.id,
        client,
        toolName: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      });
    }
  }

  function getOpenAiTools() {
    return Array.from(toolIndex.entries()).map(([fullName, meta]) => ({
      type: "function",
      name: fullName, // docs__search_docs, reminder__add_reminder и т.д.
      description: meta.description,
      parameters: meta.inputSchema,
    }));
  }

  async function callTool(fullName, args) {
    const meta = toolIndex.get(fullName);
    if (!meta) {
      throw new Error(`Tool not found: ${fullName}`);
    }

    const result = await meta.client.callTool({
      name: meta.toolName,
      arguments: args,
    });

    return result;
  }

  async function closeAll() {
    for (const s of servers) {
      await s.client.close();
      s.transport.close();
    }
  }

  return {
    getOpenAiTools,
    callTool,
    closeAll,
  };
}
