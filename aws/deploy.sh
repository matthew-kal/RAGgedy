STACK_NAME="S3-EventBridge-Stack"
S3_CODE_BUCKET="dev-context-engine"
TEMPLATE_FILE="template.yml"
PACKAGED_TEMPLATE_FILE="packaged-template.yml"
REGION="us-east-2"

zip -j deployment-package.zip trigger-lambda.py

aws cloudformation package \
  --template-file $TEMPLATE_FILE \
  --s3-bucket $S3_CODE_BUCKET \
  --output-template-file $PACKAGED_TEMPLATE_FILE

aws cloudformation deploy \
  --template-file $PACKAGED_TEMPLATE_FILE \
  --stack-name $STACK_NAME \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --region $REGION