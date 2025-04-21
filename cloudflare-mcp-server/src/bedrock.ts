import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";

export async function retrieve(env: Env, text: string) {
	const client = new BedrockAgentRuntimeClient({
		credentials: {
			accessKeyId: env.AWS_ACCESS_KEY_ID,
			secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
		},
		region: env.AWS_REGION,
	});

	const command = new RetrieveCommand({
		knowledgeBaseId: env.KNOWLEDGE_BASE_ID,
		retrievalQuery: { text },
	});
	const response = await client.send(command);

	return response.retrievalResults ?? [];
}
