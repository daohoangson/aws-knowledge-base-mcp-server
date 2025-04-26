import { bedrock } from "@ai-sdk/amazon-bedrock";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import { experimental_createMCPClient, MCPTransport, streamText } from "ai";

(async () => {
  const url = new URL(process.argv[2]);
  let transport: MCPTransport;
  switch (url.pathname) {
    case "/mcp":
      transport = new StreamableHTTPClientTransport(url);
      break;
    case "/sse":
      transport = new SSEClientTransport(url);
      break;
    default:
      console.error(`Unsupported URL: ${url.pathname}`);
      process.exit(1);
  }

  const client = await experimental_createMCPClient({ transport });
  console.warn("Created MCP client");

  try {
    const tools = await client.tools();
    console.warn("Got MCP tools", Object.keys(tools));

    const { fullStream } = streamText({
      model: bedrock("amazon.nova-pro-v1:0"),
      tools,
      maxSteps: 3,
      messages: [
        {
          role: "user",
          content: "Check the docs to see whether CloudFlare works with MCP?",
        },
      ],
    });

    for await (const part of fullStream) {
      switch (part.type) {
        case "tool-call":
          const { toolName, args } = part;
          console.warn("Tool call:", toolName, JSON.stringify(args, null, 2));
          break;
        case "tool-result":
          const { result } = part;
          console.warn(JSON.stringify(result, null, 2));
          break;
        case "text-delta":
          const { textDelta } = part;
          process.stdout.write(textDelta);
          break;
        case "step-finish":
        case "step-start":
        case "finish":
          process.stderr.write("\n");
          break;
        default:
          const { type } = part;
          console.warn("Unknown part:", { type });
          break;
      }
    }
  } finally {
    await transport.close();
  }
})();
