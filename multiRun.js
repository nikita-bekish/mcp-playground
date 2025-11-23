import { runMultiFlow } from "./multiAgent.js";

const q =
  process.argv.slice(2).join(" ") ||
  "найди документ про MCP и сделай summary, а потом создай напоминание перечитать его через час";

runMultiFlow(q)
  .then(() => {
    console.log("Flow finished");
  })
  .catch((err) => {
    console.error("Error in multi flow:", err);
  });
