"""
This initial block sets up the function's environment. It imports necessary
libraries, including `boto3` for AWS interaction. A global logger is
configured to send logs to CloudWatch, and a reusable DynamoDB resource
client is initialized outside the main handler for better performance on
"warm" Lambda invocations.
"""
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


"""
This function serves as a generic handler to update a document's processing
status in a DynamoDB table. The entire handler is wrapped in a try...except
block to act as a global error handler, ensuring that any unexpected
failures are caught and a proper `500 Internal Server Error` is returned.
"""
def lambda_handler(event, context):
    try:
        logger.info(f"Received event: {json.dumps(event)}")

        """
        This first section within the handler is responsible for robustly parsing the
        incoming `event`. It can handle inputs from different sources like Step
        Functions or API Gateway. It extracts the essential `document_key` and
        `status` parameters and validates their presence, failing fast with a `400 Bad
        Request` error if they're missing.
        """
        if 'body' in event:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        else:
            body = event

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

        """
        This block prepares the data payload for the database. It gets the table
        name from an environment variable for maintainability. It then assembles the
        `item` dictionary, creating a UTC timestamp for the update and conditionally
        adding any optional details like an `error_message` that might have been
        passed in the event.
        """
        table_name = os.environ['STATUS_TABLE']
        table = dynamodb.Table(table_name)

        item = {
            'document_key': document_key,
            'status': status,
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }

        if 'error_message' in body:
            item['error_message'] = body['error_message']

        if 'chunks_processed' in body:
            item['chunks_processed'] = body['chunks_processed']

        """
        This final block executes the core logic. It uses a nested try...except
        to specifically handle errors from the database call (`ClientError`). If the
        `table.put_item(Item=item)` call succeeds, it logs the success and returns
        a `200 OK` response. If the database call fails, it logs the specific
        `ClientError` and returns a `500` error.
        """
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