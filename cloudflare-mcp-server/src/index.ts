import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import * as bedrock from "./bedrock";

export class KnowledgeBaseMcpServer extends McpAgent {
	server = new McpServer({
		name: "Demo",
		version: "1.0.0",
	});

	async init() {
		this.server.tool(
			"search_knowledge_base",
			"Search for documentation of CloudFlare infrastructure and Model Context Protocol specification.",
			{ query: z.string() },
			async ({ query }) => {
				// @ts-expect-error unknown type
				const env: Env = this.env;
				const results = await bedrock.retrieve(env, query);
				const content: CallToolResult["content"] = results
					.map((result) => result.content?.text ?? "")
					.filter((text) => text.length > 0)
					.map((text) => ({ type: "text", text }));
				return { content };
			},
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		const envAsRecord = env as unknown as Record<string, any>;
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			// HTTP with SSE transport, deprecated as of 2025-03-26
			// https://github.com/modelcontextprotocol/modelcontextprotocol/blob/2024-11-05/docs/specification/basic/transports.md#http-with-sse
			return KnowledgeBaseMcpServer.serveSSE("/sse").fetch(request, envAsRecord, ctx);
		}

		if (url.pathname === "/mcp") {
			// Streamable HTTP transport
			// https://github.com/modelcontextprotocol/modelcontextprotocol/blob/2025-03-26/docs/specification/2025-03-26/basic/transports.md#streamable-http
			return KnowledgeBaseMcpServer.serve("/mcp").fetch(request, envAsRecord, ctx);
		}

		return Response.redirect("https://github.com/daohoangson/aws-knowledge-base-mcp-server");
	},
};
