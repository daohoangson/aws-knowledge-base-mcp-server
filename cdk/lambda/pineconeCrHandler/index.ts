import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  OnEventRequest,
  OnEventResponse,
} from "aws-cdk-lib/custom-resources/lib/provider-framework/types";

const client = new SecretsManagerClient();

async function getApiKey(): Promise<string> {
  const { SecretString } = await client.send(
    new GetSecretValueCommand({
      SecretId: process.env.PINECONE_SECRET_NAME,
    })
  );
  const { apiKey } = JSON.parse(SecretString!);
  return apiKey;
}

export const handler = async ({
  RequestType,
  ResourceProperties,
}: OnEventRequest): Promise<OnEventResponse> => {
  const apiKey = await getApiKey();
  const pinecone = new Pinecone({ apiKey });

  switch (RequestType) {
    case "Create":
      const Data = (await pinecone.createIndex({
        dimension: parseInt(ResourceProperties.IndexDimension),
        name: ResourceProperties.IndexName,
        spec: {
          serverless: {
            cloud: "aws",
            region: ResourceProperties.IndexRegion,
          },
        },
      }))!;
      return { Data };
    case "Delete":
      await pinecone.deleteIndex(ResourceProperties.IndexName);
      return {};
  }

  throw new Error(`Unsupported request type: ${RequestType}`);
};
