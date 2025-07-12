#!/bin/bash

# AWS CloudFormation deployment script for RAG application

STACK_NAME="rag-serverless-stack"
S3_CODE_BUCKET="dev-context-engine"
TEMPLATE_FILE="template.yml"
PACKAGED_TEMPLATE_FILE="packaged-template.yml"
REGION="us-east-2"

# Check if bucket exists, if not create it
echo "Checking if S3 bucket exists..."
if ! aws s3api head-bucket --bucket $S3_CODE_BUCKET --region $REGION 2>/dev/null; then
    echo "Creating S3 bucket: $S3_CODE_BUCKET"
    aws s3 mb s3://$S3_CODE_BUCKET --region $REGION
fi

echo "Packaging CloudFormation template..."
aws cloudformation package \
  --template-file $TEMPLATE_FILE \
  --s3-bucket $S3_CODE_BUCKET \
  --output-template-file $PACKAGED_TEMPLATE_FILE \
  --region $REGION

echo "Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-file $PACKAGED_TEMPLATE_FILE \
  --stack-name $STACK_NAME \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --region $REGION \
  --parameter-overrides StackName=$STACK_NAME

echo "Deployment complete!"
echo "Getting stack outputs..."
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table

echo ""
echo "Your API endpoint:"
aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text