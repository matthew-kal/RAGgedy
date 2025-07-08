# This script packages and deploys the CloudFormation stack.

# --- Configuration ---
STACK_NAME="S3-EventBridge-Stack"
S3_CODE_BUCKET="dev-context-engine"
TEMPLATE_FILE="template.yml"
PACKAGED_TEMPLATE_FILE="packaged-template.yml"

# --- Script ---
echo "Starting deployment for stack: $STACK_NAME"

# Step 1: Package the CloudFormation template
# This zips the local code (in trigger-lambda/) and uploads it to the specified S3 bucket.
echo "Packaging local code from '$TEMPLATE_FILE' and uploading to S3 bucket '$S3_CODE_BUCKET'..."
aws cloudformation package \
  --template-file $TEMPLATE_FILE \
  --s3-bucket $S3_CODE_BUCKET \
  --output-template-file $PACKAGED_TEMPLATE_FILE

# Check if packaging was successful
if [ $? -ne 0 ]; then
  echo "CloudFormation packaging failed. Aborting."
  exit 1
fi

echo "Packaging complete. Output template is '$PACKAGED_TEMPLATE_FILE'."

# Step 2: Deploy the packaged template
# This creates or updates the AWS resources based on the template.
echo "Deploying stack '$STACK_NAME'..."
aws cloudformation deploy \
  --template-file $PACKAGED_TEMPLATE_FILE \
  --stack-name $STACK_NAME \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

# Check if deployment was successful
if [ $? -ne 0 ]; then
  echo "CloudFormation deployment failed."
  exit 1
fi

echo "Deployment successful for stack '$STACK_NAME'!"