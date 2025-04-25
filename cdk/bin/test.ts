import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  console.log("Starting...");
  const transport = new StreamableHTTPClientTransport(
    new URL(
      "https://vc7ejtu4kk3ayeiqofkmxxzada0uwpzr.lambda-url.us-east-1.on.aws/mcp"
    )
  );

  const client = new Client({
    name: "example-client",
    version: "1.0.0",
  });

  console.log("Connecting...");
  await client.connect(transport);

  console.log("Connected", client.getServerCapabilities());

  const result = await client.listTools();
  console.log(result);
}

main();
