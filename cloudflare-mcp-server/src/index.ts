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
		this.server.tool("search_knowledge_base", { query: z.string() }, async ({ query }) => {
			// @ts-expect-error unknown type
			const env: Env = this.env;
			const results = await bedrock.retrieve(env, query);
			const content: CallToolResult["content"] = results
				.map((result) => {
					const text = result.content?.text;
					const uri = result.location?.s3Location?.uri;
					if (typeof text !== "string" || typeof uri !== "string") {
						console.error("Unrecognized result", result);
						return undefined;
					}

					return { uri, text };
				})
				.filter((resource) => typeof resource !== "undefined")
				.map((resource) => ({ type: "resource", resource }));
			return { content };
		});
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
