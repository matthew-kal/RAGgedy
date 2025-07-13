import json
import boto3 
import os
import logging
from botocore.exceptions import ClientError 

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize S3 client
s3_client = boto3.client('s3')

def lambda_handler(event, context):
    """Generate a presigned POST URL for S3 file upload"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Parse the request body
        if 'body' in event:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        else:
            body = event
        
        # Get required parameters
        filename = body.get('filename')
        content_type = body.get('contentType')
        
        if not filename:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'filename is required'})
            }
        
        # Get bucket name from environment
        bucket_name = os.environ['RAW_FILES_BUCKET']
        
        # Create unique object key
        object_key = filename
        
        # Define presigned POST parameters
        fields = {
            'Content-Type': content_type or 'application/octet-stream'
        }
        
        conditions = [
            ['content-length-range', 1, 100 * 1024 * 1024],  # 100MB max
            {'Content-Type': content_type or 'application/octet-stream'}
        ]
        
        # Generate presigned POST URL
        try:
            response = s3_client.generate_presigned_post(
                Bucket=bucket_name,
                Key=object_key,
                Fields=fields,
                Conditions=conditions,
                ExpiresIn=300  # 5 minutes
            )
            
            logger.info(f"Generated presigned URL for {filename}")
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'url': response['url'],
                    'fields': response['fields'],
                    'document_key': object_key
                })
            }
            
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {str(e)}")
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Failed to generate upload URL'})
            }
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Internal server error: {str(e)}'})
        } 