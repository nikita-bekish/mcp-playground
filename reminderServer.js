import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import fs from "fs";
import { z } from "zod";

dotenv.config();

const DB_FILE = "reminders_multi.json";

function loadDb() {
  if (!fs.existsSync(DB_FILE)) return [];
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

const server = new McpServer({
  name: "reminder-server",
  version: "1.0.0",
});

// add_reminder
server.registerTool(
  "add_reminder",
  {
    description: "Add new reminder with text and datetime",
    inputSchema: {
      text: z.string().min(1).describe("Reminder text in natural language"),
      remindAt: z
        .string()
        .min(1)
        .describe("When to remind (ISO string or human text)"),
    },
  },
  async ({ text, remindAt }) => {
    const db = loadDb();
    const reminder = {
      id: db.length + 1,
      text,
      remindAt,
      createdAt: new Date().toISOString(),
    };
    db.push(reminder);
    saveDb(db);

    return {
      content: [
        {
          type: "text",
          text: `Reminder #${reminder.id} saved: "${text}" at ${remindAt}`,
        },
      ],
    };
  }
);

// list_reminders
server.registerTool(
  "list_reminders",
  {
    description: "List all saved reminders",
    inputSchema: {
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe("Max reminders to return"),
    },
  },
  async ({ limit }) => {
    const db = loadDb();
    const items = typeof limit === "number" ? db.slice(0, limit) : db;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(items, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("reminder-server error:", err);
});
