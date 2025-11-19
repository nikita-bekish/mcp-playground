import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function createClient(serverScript) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScript], // pass path to file
  });

  const client = new Client({
    name: "reminder-client",
    version: "1.0.0",
  });

  await client.connect(transport);

  return { client, transport };
}
