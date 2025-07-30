"""
This initial block handles the setup of the function's environment. It imports
necessary libraries like `boto3` for AWS interaction and `os` for environment
variables. It also configures a global logger for CloudWatch and initializes
a reusable S3 client outside the main handler for better performance on
"warm" Lambda invocations.
"""

import json
import boto3
import os
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')

"""
This block serves as the main entry point. Its primary purpose is to safely
parse the incoming request `event` from API Gateway, which may have its
body formatted as a string or a dictionary. It extracts the `filename` and
`contentType`, then immediately validates that a `filename` was provided,
failing fast with a `400 Bad Request` if it's missing.
"""

def lambda_handler(event, context):
    try:
        logger.info(f"Received event: {json.dumps(event)}")

        if 'body' in event:
            if isinstance(event['body'], str):
                body = json.loads(event['body'])
            else:
                body = event['body']
        else:
            body = event

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

        """
        This block prepares the specific parameters for the upload. It retrieves the
        target S3 bucket name from an environment variable to keep configuration
        separate from code. Most importantly, it defines the `conditions`, which are a
        set of server-side rules that S3 will enforce, such as a 100MB file size
        limit and a matching content type. This acts as a security contract for the
        upload.
        """
        bucket_name = os.environ['RAW_FILES_BUCKET']

        object_key = filename

        fields = {
            'Content-Type': content_type or 'application/octet-stream'
        }

        conditions = [
            ['content-length-range', 1, 100 * 1024 * 1024],
            {'Content-Type': content_type or 'application/octet-stream'}
        ]

        """
        This is the core logic block. It calls the S3 client's
        `generate_presigned_post` method, passing in the bucket, key, and security
        conditions. If S3 successfully agrees to these terms, it returns a temporary
        URL and a set of signed fields. This block then formats that data into a
        `200 OK` JSON response for the frontend application to use for the direct
        S3 upload.
        """

        try:
            response = s3_client.generate_presigned_post(
                Bucket=bucket_name,
                Key=object_key,
                Fields=fields,
                Conditions=conditions,
                ExpiresIn=300
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

            """
            This final block provides robust error handling for the entire process. The
            inner `try...except ClientError` specifically catches errors returned from
            the AWS S3 API (e.g., bucket not found). The outer `try...except Exception`
            is a fail-safe that catches any other unexpected errors, ensuring the function
            always returns a properly formatted `500 Internal Server Error` instead of
            crashing.
            """
            
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