import json
import os
import boto3
import base64
import logging
from urllib.parse import urlparse
from common.utils import create_bedrock_client

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients using shared utilities
# opensearch_endpoint = os.environ['OPENSEARCH_ENDPOINT']
# opensearch_client = create_opensearch_client(opensearch_endpoint)
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
    """Generate description for image using Claude 3 Haiku with structured JSON output"""
    try:
        # Encode image to base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        # Structured prompt for JSON output
        prompt = """Analyze this image and provide a detailed description in JSON format. Use this exact structure:

{
  "main_subjects": ["list", "of", "main objects or people"],
  "setting": "description of background or environment",
  "colors_and_style": "description of colors, lighting, and visual style",
  "visible_text": "any text or numbers visible in the image",
  "overall_context": "inferred purpose or context of the image",
  "detailed_description": "comprehensive paragraph describing the entire image"
}

Be factual and detailed. If any field is not applicable, use an empty string or array."""

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
        json_description = response_body['content'][0]['text']
        
        # Parse the JSON
        try:
            structured_desc = json.loads(json_description)
            # Combine into a single string for embedding
            description = json.dumps(structured_desc)
        except json.JSONDecodeError:
            description = json_description  # Fallback if not valid JSON
        
        # Truncate to safe length for embedding
        description = description[:20000]
        
        logger.info(f"Generated image description: {len(description)} characters")
        return description
        
    except Exception as e:
        logger.error(f"Error generating image description: {str(e)}")
        raise

def lambda_handler(event, context):
    """Process image and return description for aggregation"""
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
        
        # Return processed data for aggregation
        return {
            'statusCode': 200,
            'image_s3_uri': image_s3_uri,
            'llm_generated_description': description,
            'metadata': metadata,
            'content_type': 'image',
            'image_content_type': content_type
        }
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'error': f'Internal server error: {str(e)}'
        } 