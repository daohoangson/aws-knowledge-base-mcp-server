import { amazonaurora, bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import {
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps as CdkStackProps,
} from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface StackProps extends CdkStackProps {}

export class CdkStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const embeddingsModel =
      bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024;

    const auroraVectorStore = new amazonaurora.AmazonAuroraVectorStore(
      this,
      "auroraVectorStore",
      {
        embeddingsModelVectorDimension: embeddingsModel.vectorDimensions!,
      }
    );

    const knowledgeBase = new bedrock.VectorKnowledgeBase(
      this,
      "knowledgeBase",
      {
        embeddingsModel,
        vectorStore: auroraVectorStore,
      }
    );

    const docsBucket = new s3.Bucket(this, "docsBucket", {
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const s3DataSource = new bedrock.S3DataSource(this, "s3DataSource", {
      bucket: docsBucket,
      knowledgeBase: knowledgeBase,
    });

    const user = new iam.User(this, "user");
    const accessKey = new iam.AccessKey(this, "accessKey", { user });
    const policy = new iam.Policy(this, "policy", {
      statements: [
        new iam.PolicyStatement({
          actions: ["bedrock:Retrieve"],
          resources: [knowledgeBase.knowledgeBaseArn],
        }),
      ],
    });
    policy.attachToUser(user);

    new CfnOutput(this, "AwsAccessKeyId", { value: accessKey.accessKeyId });
    new CfnOutput(this, "AwsRegion", { value: this.region });
    new CfnOutput(this, "AwsSecretAccessKey", {
      value: accessKey.secretAccessKey.unsafeUnwrap(),
    });
    new CfnOutput(this, "DataSourceId", {
      value: s3DataSource.dataSourceId,
    });
    new CfnOutput(this, "DocsBucketName", { value: docsBucket.bucketName });
    new CfnOutput(this, "KnowledgeBaseId", {
      value: knowledgeBase.knowledgeBaseId,
    });
  }
}
