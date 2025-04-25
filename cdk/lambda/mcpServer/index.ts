import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { z } from "zod";
import { retrieveFromBedrock } from "./bedrock";

const server = new McpServer({
  name: "aws-knowledge-base",
  version: "1.0.0",
});

server.tool(
  "search_knowledge_base",
  "Search for documentation of CloudFlare infrastructure and Model Context Protocol specification.",
  { query: z.string() },
  async ({ query }) => {
    const results = await retrieveFromBedrock(query);
    const content: CallToolResult["content"] = results
      .map((result) => result.content?.text ?? "")
      .filter((text) => text.length > 0)
      .map((text) => ({ type: "text", text }));
    return { content };
  }
);

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // stateless mode
});

const app = new Hono();
app.post("/mcp", async (c) => {
  console.log(c.req);
  const { req, res } = toReqRes(c.req.raw);
  res.on("close", () => {
    console.log("Response closed");
  });

  const body = await c.req.json();
  console.log("Handling request...", { body });
  await transport.handleRequest(req, res, body);

  // res.end();

  console.log("Converting response...");
  const response = await toFetchResponse(res);
  console.log("Converted", { response });
  return response;
});

process.on("SIGINT", async () => {
  await transport.close().catch(console.error);
  await server.close().catch(console.error);
  process.exit(0);
});

export const handler = handle(app);
