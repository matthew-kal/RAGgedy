import json
import boto3
import os
import logging
from datetime import datetime, timezone
from botocore.exceptions import ClientError

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """Update document processing status in DynamoDB"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Parse event data (can come from Step Functions or direct invocation)
        if 'body' in event:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        else:
            body = event
        
        # Get required parameters
        document_key = body.get('document_key')
        status = body.get('status')
        
        if not document_key or not status:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'document_key and status are required'})
            }
        
        # Get table name from environment
        table_name = os.environ['STATUS_TABLE']
        table = dynamodb.Table(table_name)
        
        # Prepare item for DynamoDB
        item = {
            'document_key': document_key,
            'status': status,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        # Add additional metadata if provided
        if 'error_message' in body:
            item['error_message'] = body['error_message']
        
        if 'chunks_processed' in body:
            item['chunks_processed'] = body['chunks_processed']
        
        # Update item in DynamoDB
        try:
            table.put_item(Item=item)
            logger.info(f"Updated status for {document_key} to {status}")
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'message': 'Status updated successfully',
                    'document_key': document_key,
                    'status': status
                })
            }
            
        except ClientError as e:
            logger.error(f"Error updating status: {str(e)}")
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Failed to update status'})
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