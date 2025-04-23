import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient();

export async function retrieveFromBedrock(text: string) {
  const command = new RetrieveCommand({
    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
    retrievalQuery: { text },
  });
  const response = await client.send(command);
  return response.retrievalResults ?? [];
}
