import OAuthProvider from "@cloudflare/workers-oauth-provider";
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

// Export the OAuth handler as the default
export default new OAuthProvider({
	apiRoute: "/sse",
	// TODO: fix these types
	// @ts-ignore
	apiHandler: KnowledgeBaseMcpServer.mount("/sse"),
	authorizeEndpoint: "/authorize",
	defaultHandler: {
		// @ts-ignore
		fetch: () => Response.json({}),
	},
	tokenEndpoint: "/token",
	clientRegistrationEndpoint: "/register",
});
