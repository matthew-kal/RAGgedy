import json
import os
import logging
# from common.utils import create_opensearch_client, create_bedrock_client, get_embedding

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients using shared utilities
# opensearch_endpoint = os.environ['OPENSEARCH_ENDPOINT']
# opensearch_client = create_opensearch_client(opensearch_endpoint)
# bedrock_client = create_bedrock_client()

def lambda_handler(event, context):
    """Process text chunk and return it for aggregation"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Extract text chunk data from event
        text_chunk = event.get('text', '')
        metadata = event.get('metadata', {})
        
        if not text_chunk:
            logger.error("No text content found in event")
            return {
                'statusCode': 400,
                'error': 'Text content is required'
            }
        
        logger.info(f"Processing text chunk: {len(text_chunk)} characters")
        
        # Simply return the input data for aggregation
        return {
            'statusCode': 200,
            'text': text_chunk,
            'metadata': metadata,
            'content_type': 'text'
        }
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'error': f'Internal server error: {str(e)}'
        } 