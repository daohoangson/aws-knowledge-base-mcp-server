# AWS Knowledge Base MCP Server

## Usage

<table><tr><td>Claude Desktop</td><td>GitHub Copilot</td></tr><tr><td>

```json
{
  "mcpServers": {
    "knowledge-base": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://aws-knowledge-base-mcp-server.daohoangson.workers.dev/sse"
      ]
    }
  }
}
```

</td><td>

```json
{
  "servers": {
    "aws-knowledge-base": {
      "type": "sse",
      "url": "https://aws-knowledge-base-mcp-server.daohoangson.workers.dev/sse"
    }
  }
}
```

</tr><tr><td>

![](./claude_desktop.png)

</td><td>

![](./github_copilot.png)

</td></tr></table>

A Model Context Protocol (MCP) server implementation that enables AI assistants to search through Knowledge Base using AWS Bedrock and Cloudflare Workers. This project consists of two main components:

## Architecture

1. **Infrastructure** (`/cdk`): Sets up the resources including:

   - AWS Bedrock Knowledge Base for document embeddings
   - Aurora Serverless v2 with pgvector for efficient document search
   - AWS S3 bucket for storing documentation files
   - AWS IAM user and policies for API access

2. **Cloudflare MCP Server** (`/cloudflare-mcp-server`): Implements the MCP server that:
   - Provides a `search_knowledge_base` tool for AI assistants
   - Integrates with AWS Bedrock for document retrieval
   - Runs on Cloudflare Workers

```mermaid
graph TD
  subgraph AWS
    S3[S3 Bucket] -->|Stores Documents| KnowledgeBase
    TitanModel[Titan Embed Text V2] -->|Embedding Model| KnowledgeBase
    KnowledgeBase[Bedrock Knowledge Base] -->|Vector Embeddings| Aurora[Aurora Serverless v2<br />with pgvector]
  end

  subgraph Cloudflare
    Worker -->|Retrieve API| KnowledgeBase
  end

  LLM[LLM Model] -->|MCP<br />Server Sent Event| Worker
```

## Infrastructure

### Environment Variables

- `CDK_APP_ID` - Unique identifier for the CDK stack

### Setup

```bash
cd cdk

# Install dependencies
npm install

# Set required environment variables
export CDK_APP_ID="your-app-id"

# Deploy the stack
npx cdk deploy
```

## Cloudflare MCP Server

The MCP server provides a `search_knowledge_base` tool that can be used by AI assistants to search through indexed documents. The tool accepts a query string and returns relevant documentation.

### Environment Variables

- `AWS_ACCESS_KEY_ID` - AWS access key for Bedrock API
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for Bedrock API
- `AWS_REGION` - AWS region (e.g., "us-east-1")
- `KNOWLEDGE_BASE_ID` - Bedrock Knowledge Base ID

### Setup

```bash
cd cloudflare-mcp-server

# Install dependencies
npm install

# Configure Wrangler
# Update wrangler.jsonc with your AWS credentials and Knowledge Base ID

# Deploy to Cloudflare
npm run deploy
```

## Cost Estimation

Assumptions:

- `us-east-1` region
- Total 2,000 documents
- Each document is ~5KB / ~1,250 tokens
- Re-index everything 30 times per month (real implementation will do it incrementally)
- Usage 3,000 requests per month
- Each request takes 5ms CPU time / 200ms wall time
- Each query is ~100 tokens
- Each request returns 10 documents

| Service    | SKU                         | Listing Price         | Monthly Count  | Monthly Cost (USD) |
| ---------- | --------------------------- | --------------------- | -------------- | ------------------ |
| Vector DB  | PostgreSQL Serverless v2    | $0.12 / ACU‑hour      | 0.5 \* 730h x2 | $87.6              |
|            | PostgreSQL Standard Storage | $0.10 / GB-month      | 10 GB          | $1                 |
|            | NAT Gateways                | $0.045 / hour         | 730h x2        | $65.7              |
|            | VPC Endpoints               | $0.01 / AZ-hour       | 730h x2 x2     | $29.2              |
| LLMOps     | Titan Embeddings (Indexing) | $0.00002 / 1K tokens  | 75,000K        | $1.5               |
|            | Titan Embeddings (Queries)  | $0.00002 / 1K tokens  | 300K           | $0.006             |
| Storage    | S3 Standard Storage         | $0.023 / GB-month     | 0.01 GB        | $0.00023           |
|            | S3 LIST Requests            | $0.005 / 1K requests  | 6K             | $0.03              |
|            | S3 GET Requests             | $0.0004 / 1K requests | 60K            | $0.024             |
| CloudFlare | Standard                    | $5 / month            | 1              | $5                 |
|            | Requests                    | $0.30 / million       | 0.003          | $0.0009            |
|            | CPU time                    | $0.00002 / CPU-second | 15             | $0.0003            |

- https://aws.amazon.com/rds/aurora/pricing/
  - 2 Aurora instances: 1 writer, 1 reader via [scaleWithWriter: true](https://github.com/awslabs/generative-ai-cdk-constructs/blob/601e3ad/src/cdk-lib/amazonaurora/aurora-vector-store.ts)
  - 2 NAT gateways via [PRIVATE_WITH_EGRESS](https://github.com/awslabs/generative-ai-cdk-constructs/blob/601e3ad/src/common/helpers/vpc-helper.ts)
  - Alternatives:
    - Amazon OpenSearch Serverless for $350/mo minimum because it needs at least 1 indexing OCU and 1 searching OCU at [$0.24 / OCU-hour](https://aws.amazon.com/opensearch-service/pricing/)
    - Pinecone Standard plan for $25/mo with [$15 usage credits](https://www.pinecone.io/pricing/) → see PR https://github.com/daohoangson/aws-knowledge-base-mcp-server/pull/1
- https://aws.amazon.com/bedrock/pricing/
- https://aws.amazon.com/s3/pricing/
- CloudFlare Standard plan includes [10M requests and 3K CPU-seconds](https://developers.cloudflare.com/workers/platform/pricing/). Alternative: AWS Lambda → see PR https://github.com/daohoangson/aws-knowledge-base-mcp-server/pull/2
