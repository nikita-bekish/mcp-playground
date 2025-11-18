import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import OpenAI from "openai";
import z from "zod";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

server.registerTool(
  "analyze_repo_with_ai",
  {
    description: "Analyze a GitHub repository using OpenAI to provide insights",
    inputSchema: {
      owner: z.string().min(1).describe("Repository owner username"),
      repo: z.string().min(1).describe("Repository name"),
      focus: z
        .enum(["general", "code_quality", "documentation", "architecture"])
        .default("general")
        .describe("What aspect to focus the analysis on"),
    },
  },
  async ({ owner, repo, focus }) => {
    try {
      // Получаем данные репозитория
      const repoResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`
      );
      if (!repoResponse.ok) {
        throw new Error(`GitHub API error: ${repoResponse.status}`);
      }
      const repoInfo = await repoResponse.json();

      // Формируем промпт для OpenAI
      const prompt = `Analyze this GitHub repository and provide insights:

Repository: ${repoInfo.full_name}
Description: ${repoInfo.description || "No description"}
Language: ${repoInfo.language || "Not specified"}
Stars: ${repoInfo.stargazers_count}
Forks: ${repoInfo.forks_count}
Issues: ${repoInfo.open_issues_count}
Size: ${repoInfo.size} KB
Last updated: ${new Date(repoInfo.updated_at).toLocaleDateString()}

Focus area: ${focus}

Please provide:
1. Brief summary of what this repository does
2. Key strengths and potential concerns
3. Suggestions for improvement
4. Overall assessment (1-10 rating)`;

      // Запрос к OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are an expert software engineer and code reviewer. Provide detailed, constructive analysis.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const analysis = completion.choices[0].message.content;

      return {
        content: [
          {
            type: "text",
            text: `🤖 AI Analysis of ${owner}/${repo}\n\n${analysis}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing repository: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.registerTool(
  "get_user_repos_count",
  {
    description: "Get the count of public repositories for a GitHub user",
    inputSchema: {
      username: z.string().min(1).describe("GitHub username"),
    },
  },
  async ({ username }) => {
    try {
      const response = await fetch(`https://api.github.com/users/${username}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const user = await response.json();
      const repoCount = user.public_repos;

      return {
        content: [
          {
            type: "text",
            text: `User: ${user.login}\nPublic repositories: ${repoCount}\nFollowers: ${user.followers}\nFollowing: ${user.following}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching user ${username}: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Новые инструменты для работы с Tasks API (jsonplaceholder.typicode.com)
server.registerTool(
  "get_task_count",
  {
    description: "Get the total count of tasks from JSONPlaceholder API",
    inputSchema: {},
  },
  async () => {
    try {
      const response = await fetch(
        "https://jsonplaceholder.typicode.com/todos"
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const tasks = await response.json();
      const count = tasks.length;

      return {
        content: [
          {
            type: "text",
            text: `Total tasks available: ${count}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching task count: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.registerTool(
  "get_user_repos",
  {
    description: "Get a list of repositories for a GitHub user",
    inputSchema: {
      username: z.string().min(1).describe("GitHub username"),
      limit: z
        .number()
        .min(1)
        .max(30)
        .default(5)
        .describe("Number of repositories to return (1-30)"),
    },
  },
  async ({ username, limit }) => {
    try {
      const response = await fetch(
        `https://api.github.com/users/${username}/repos?per_page=${limit}&sort=updated`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const repos = await response.json();

      // Форматируем репозитории в читаемый вид
      const formattedRepos = repos
        .map(
          (repo, index) =>
            `${index + 1}. ${repo.name} ${
              repo.private ? "(Private)" : "(Public)"
            }\n   ⭐ ${repo.stargazers_count} | 🍴 ${
              repo.forks_count
            } | 📅 ${new Date(repo.updated_at).toLocaleDateString()}\n   ${
              repo.description || "No description"
            }`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text",
            text: `Repositories for ${username} (showing ${repos.length}):\n\n${formattedRepos}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching repositories for ${username}: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.registerTool(
  "get_repo_info",
  {
    description: "Get detailed information about a specific GitHub repository",
    inputSchema: {
      owner: z.string().min(1).describe("Repository owner username"),
      repo: z.string().min(1).describe("Repository name"),
    },
  },
  async ({ owner, repo }) => {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const repoInfo = await response.json();

      const formatted = [
        `Repository: ${repoInfo.full_name}`,
        `Description: ${repoInfo.description || "No description"}`,
        `Language: ${repoInfo.language || "Not specified"}`,
        `Stars: ${repoInfo.stargazers_count} | Forks: ${repoInfo.forks_count}`,
        `Issues: ${repoInfo.open_issues_count} | Size: ${repoInfo.size} KB`,
        `Default Branch: ${repoInfo.default_branch}`,
        `Created: ${new Date(repoInfo.created_at).toLocaleDateString()}`,
        `Last Updated: ${new Date(repoInfo.updated_at).toLocaleDateString()}`,
        `URL: ${repoInfo.html_url}`,
      ].join("\n");

      return {
        content: [
          {
            type: "text",
            text: formatted,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching repository ${owner}/${repo}: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.registerTool(
  "get_tasks",
  {
    description: "Get a list of tasks from JSONPlaceholder API",
    inputSchema: {
      limit: z
        .number()
        .min(1)
        .max(20)
        .default(5)
        .describe("Number of tasks to return (1-20)"),
    },
  },
  async ({ limit }) => {
    try {
      const response = await fetch(
        `https://jsonplaceholder.typicode.com/todos?_limit=${limit}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const tasks = await response.json();

      // Форматируем задачи в читаемый вид
      const formattedTasks = tasks
        .map(
          (task, index) =>
            `${index + 1}. [${task.completed ? "✓" : "○"}] ${
              task.title
            } (User ID: ${task.userId})`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Tasks (showing ${tasks.length} of available):\n\n${formattedTasks}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching tasks: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.registerTool(
  "get_task",
  {
    description: "Get a specific task by ID from JSONPlaceholder API",
    inputSchema: {
      id: z.number().min(1).max(200).describe("Task ID (1-200)"),
    },
  },
  async ({ id }) => {
    try {
      const response = await fetch(
        `https://jsonplaceholder.typicode.com/todos/${id}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const task = await response.json();

      const formatted = [
        `Task #${task.id}:`,
        `Title: ${task.title}`,
        `Status: ${task.completed ? "Completed ✓" : "Not completed ○"}`,
        `User ID: ${task.userId}`,
      ].join("\n");

      return {
        content: [
          {
            type: "text",
            text: formatted,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching task ${id}: ${error.message}`,
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
