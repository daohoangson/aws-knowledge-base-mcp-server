#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { CdkStack, StackProps } from "../lib/cdk-stack";

const appId = process.env.CDK_APP_ID ?? "";
const stackProps: StackProps = {};
if (appId === "") {
  throw new Error("Please set all required environment variables.");
}

const app = new App();
new CdkStack(app, appId, stackProps);
