import { bedrock, pinecone } from "@cdklabs/generative-ai-cdk-constructs";
import {
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps as CdkStackProps,
  Duration,
  CustomResource,
  SecretValue,
} from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as cr from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { join } from "path";

export interface StackProps extends CdkStackProps {
  pineconeApiKey: string;
}

export class CdkStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    { pineconeApiKey, ...props }: StackProps
  ) {
    super(scope, id, props);

    const embeddingsModel =
      bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V2_1024;

    const pineconeSecret = new secretsmanager.Secret(this, "pineconeSecret", {
      secretObjectValue: {
        apiKey: SecretValue.unsafePlainText(pineconeApiKey),
      },
    });

    const pineconeCrHandler = new NodejsFunction(this, "pineconeCrHandler", {
      entry: join(__dirname, "../lambda/pineconeCrHandler/index.ts"),
      environment: {
        PINECONE_SECRET_NAME: pineconeSecret.secretName,
      },
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.minutes(1),
    });
    pineconeSecret.grantRead(pineconeCrHandler);

    const pineconeCrProvider = new cr.Provider(this, "pineconeCrProvider", {
      onEventHandler: pineconeCrHandler,
    });

    // has to implement custom resource instead of using something like `pinecone-db-construct@0.10.0`
    // because it was a bit outdated and didn't support `us-east-1` as a serverless region
    // and more importantly, there was no way to obtain the host after creation
    const pineconeIndex = new CustomResource(this, "pineconeIndex", {
      properties: {
        IndexDimension: embeddingsModel.vectorDimensions!,
        IndexName: this.stackName
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, " ")
          .trim()
          .replace(/\s+/, "-"),
        IndexRegion: this.region,
      },
      serviceToken: pineconeCrProvider.serviceToken,
    });

    const knowledgeBase = new bedrock.VectorKnowledgeBase(
      this,
      "knowledgeBase",
      {
        embeddingsModel,
        vectorStore: new pinecone.PineconeVectorStore({
          connectionString: `https://${pineconeIndex.getAttString("host")}`,
          credentialsSecretArn: pineconeSecret.secretArn,
          metadataField: "metadata",
          textField: "text",
        }),
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
    new iam.Policy(this, "aiSdkPolicy", {
      statements: [
        new iam.PolicyStatement({
          actions: ["bedrock:InvokeModelWithResponseStream"],
          resources: ["*"],
        }),
      ],
    }).attachToUser(user);
    new iam.Policy(this, "cloudflarePolicy", {
      statements: [
        new iam.PolicyStatement({
          actions: ["bedrock:Retrieve"],
          resources: [knowledgeBase.knowledgeBaseArn],
        }),
      ],
    }).attachToUser(user);

    const mcpServerHandler = new NodejsFunction(this, "mcpServer", {
      entry: join(__dirname, "../lambda/mcpServer/index.ts"),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.minutes(15),

      // https://github.com/awslabs/aws-lambda-web-adapter
      architecture: lambda.Architecture.ARM_64,
      bundling: {
        commandHooks: {
          beforeInstall: () => [],
          beforeBundling: () => [],
          afterBundling: (inputDir, outputDir) => [
            `cp ${inputDir}/lambda/mcpServer/run.sh ${outputDir}`,
          ],
        },
      },
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: "/opt/bootstrap",
        AWS_LWA_INVOKE_MODE: "response_stream",
        KNOWLEDGE_BASE_ID: knowledgeBase.knowledgeBaseId,
        RUST_LOG: "info",
      },
      handler: "run.sh",
      layers: [
        lambda.LayerVersion.fromLayerVersionArn(
          this,
          "layer",
          `arn:aws:lambda:${this.region}:753240598075:layer:LambdaAdapterLayerArm64:20`
        ),
      ],
    });
    mcpServerHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:Retrieve"],
        resources: [knowledgeBase.knowledgeBaseArn],
      })
    );

    const mcpServerUrl = mcpServerHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

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
    new CfnOutput(this, "McpServerUrl ", { value: mcpServerUrl.url });
  }
}
