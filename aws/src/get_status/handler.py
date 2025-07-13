import json
import boto3
import os
import logging
from botocore.exceptions import ClientError

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize DynamoDB client
dynamodb = boto3.resource('dynamodb')

def lambda_handler(event, context):
    """Retrieve document processing status from DynamoDB"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Get document_key from path parameters
        document_key = None
        if 'pathParameters' in event and event['pathParameters']:
            document_key = event['pathParameters'].get('document_key')
        
        # Fallback to query parameters if not in path
        if not document_key and 'queryStringParameters' in event and event['queryStringParameters']:
            document_key = event['queryStringParameters'].get('document_key')
        
        if not document_key:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'document_key is required'})
            }
        
        # Get table name from environment
        table_name = os.environ['STATUS_TABLE']
        table = dynamodb.Table(table_name)
        
        # Query DynamoDB for document status
        try:
            response = table.get_item(
                Key={'document_key': document_key}
            )
            
            if 'Item' in response:
                item = response['Item']
                logger.info(f"Retrieved status for {document_key}: {item.get('status')}")
                
                # Format response
                status_info = {
                    'document_key': item['document_key'],
                    'status': item['status'],
                    'timestamp': item.get('timestamp'),
                    'updated_at': item.get('updated_at')
                }
                
                # Add optional fields if they exist
                if 'error_message' in item:
                    status_info['error_message'] = item['error_message']
                
                if 'chunks_processed' in item:
                    status_info['chunks_processed'] = item['chunks_processed']
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps(status_info)
                }
            else:
                # Document not found
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'error': 'Document not found',
                        'document_key': document_key
                    })
                }
            
        except ClientError as e:
            logger.error(f"Error retrieving status: {str(e)}")
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Failed to retrieve status'})
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