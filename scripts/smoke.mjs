import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join } from "node:path";
const serverScript = join(process.cwd(), "dist", "index.js");

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverScript],
  stderr: "inherit",
});

const client = new Client({ name: "smoke-test", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
console.log(`[smoke] ${tools.tools.length} tools registered:`);
for (const t of tools.tools) console.log(`  - ${t.name}`);

const help = await client.callTool({ name: "minehut_help", arguments: {} });
console.log("\n[smoke] minehut_help first line:", JSON.parse(JSON.stringify(help)).content[0]?.text?.split("\n")[0]);

const status = await client.callTool({ name: "minehut_status", arguments: { server: "anything" } });
console.log("[smoke] minehut_status without auth:", JSON.parse(JSON.stringify(status)).content[0]?.text?.slice(0, 120));

await client.close();
console.log("[smoke] OK");