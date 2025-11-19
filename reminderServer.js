import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "fs";
import { z } from "zod";

const DB = "./reminders.json";

function loadDb() {
  if (!fs.existsSync(DB)) return [];
  return JSON.parse(fs.readFileSync(DB, "utf8"));
}

function saveDb(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

const server = new McpServer({ name: "reminder-server", version: "1.0.0" });

server.registerTool(
  "add_reminder",
  {
    description: "Store reminder",
    inputSchema: {
      text: z.string(),
      remindAt: z.string(), // ISO
    },
  },
  async ({ text, remindAt }) => {
    const db = loadDb();
    db.push({ id: Date.now(), text, remindAt, done: false });
    saveDb(db);

    return {
      content: [
        { type: "text", text: `Reminder saved: '${text}' at ${remindAt}` },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
