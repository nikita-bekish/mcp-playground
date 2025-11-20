import { runDocsChain } from "./docsChainAgent.js";

const q = process.argv.slice(2).join(" ");

runDocsChain(q).catch((err) => {
  console.error("Error running docs chain:", err);
});
