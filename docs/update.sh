#!/bin/sh

set -e

mkdir files

curl -o ./files/cloudflare.txt https://developers.cloudflare.com/llms-full.txt

curl -o ./files/mcp.txt https://modelcontextprotocol.io/llms-full.txt

aws s3 sync "./files" "s3://${DOCS_BUCKET_NAME}" --delete

aws bedrock-agent start-ingestion-job \
  --knowledge-base-id $KNOWLEDGE_BASE_ID \
  --data-source-id $DATA_SOURCE_ID | jq | tee ingestion-job.json
