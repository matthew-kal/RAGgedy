import json
import os
import boto3
import base64
import logging
from urllib.parse import urlparse
from common.utils import create_opensearch_client, create_bedrock_client, get_embedding

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients using shared utilities
opensearch_endpoint = os.environ['OPENSEARCH_ENDPOINT']
opensearch_client = create_opensearch_client(opensearch_endpoint)
bedrock_client = create_bedrock_client()
s3_client = boto3.client('s3')

def download_image_from_s3(s3_uri):
    """Download image from S3 URI"""
    try:
        # Parse S3 URI
        parsed_uri = urlparse(s3_uri)
        bucket_name = parsed_uri.netloc
        object_key = parsed_uri.path.lstrip('/')
        
        # Download image
        response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
        image_data = response['Body'].read()
        
        # Get content type
        content_type = response.get('ContentType', 'image/jpeg')
        
        return image_data, content_type
    except Exception as e:
        logger.error(f"Error downloading image from S3: {str(e)}")
        raise

def generate_image_description(image_data, content_type):
    """Generate description for image using Claude 3 Haiku"""
    try:
        # Encode image to base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Create prompt for image description
        prompt = """Please provide a detailed description of this image. Include:
1. Main objects, people, or subjects in the image
2. Setting or background information
3. Colors, lighting, and visual style
4. Any text or numbers visible in the image
5. Overall context or purpose of the image

Be comprehensive and factual in your description."""
        
        # Call Claude 3 Haiku with image
        response = bedrock_client.invoke_model(
            modelId='anthropic.claude-3-haiku-20240307-v1:0',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": content_type,
                                    "data": image_base64
                                }
                            }
                        ]
                    }
                ]
            }),
            contentType='application/json'
        )
        
        response_body = json.loads(response['body'].read())
        description = response_body['content'][0]['text']
        
        logger.info(f"Generated image description: {len(description)} characters")
        return description
        
    except Exception as e:
        logger.error(f"Error generating image description: {str(e)}")
        raise

def lambda_handler(event, context):
    """Process image and index its description into OpenSearch"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Extract image S3 URI from event
        image_s3_uri = event.get('image_s3_uri', '')
        metadata = event.get('metadata', {})
        
        if not image_s3_uri:
            logger.error("No image S3 URI found in event")
            return {
                'statusCode': 400,
                'error': 'Image S3 URI is required'
            }
        
        logger.info(f"Processing image: {image_s3_uri}")
        
        # Download image from S3
        try:
            image_data, content_type = download_image_from_s3(image_s3_uri)
            logger.info(f"Downloaded image: {len(image_data)} bytes, type: {content_type}")
        except Exception as e:
            logger.error(f"Error downloading image: {str(e)}")
            raise
        
        # Generate description using Claude 3 Haiku
        try:
            description = generate_image_description(image_data, content_type)
        except Exception as e:
            logger.error(f"Error generating description: {str(e)}")
            raise
        
        # Generate embedding for the description
        try:
            embedding = get_embedding(description, bedrock_client)
            logger.info("Generated embedding for image description")
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            raise
        
        # Prepare document for indexing
        document = {
            'embedding': embedding,
            'text': description,
            'metadata': {
                'source': metadata.get('source_filename', 'unknown'),
                'source_filename': metadata.get('source_filename', 'unknown'),
                'page_number': metadata.get('page_number'),
                'content_type': 'image',
                'image_s3_uri': image_s3_uri,
                'image_content_type': content_type,
                'processed_at': context.aws_request_id if context else None
            }
        }
        
        # Index document into OpenSearch
        try:
            response = opensearch_client.index(
                index='rag-index',
                body=document
            )
            
            logger.info(f"Successfully indexed image description. Document ID: {response.get('_id')}")
            
            return {
                'statusCode': 200,
                'message': 'Image processed and indexed successfully',
                'document_id': response.get('_id'),
                'image_s3_uri': image_s3_uri,
                'description_length': len(description)
            }
            
        except Exception as e:
            logger.error(f"Error indexing document: {str(e)}")
            raise
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'error': f'Internal server error: {str(e)}'
        } 