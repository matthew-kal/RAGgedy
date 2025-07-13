import json
import os
import logging
from common.utils import create_opensearch_client, create_bedrock_client, get_embedding

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients using shared utilities
opensearch_endpoint = os.environ['OPENSEARCH_ENDPOINT']
opensearch_client = create_opensearch_client(opensearch_endpoint)
bedrock_client = create_bedrock_client()

def lambda_handler(event, context):
    """Process text chunk and index it into OpenSearch"""
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
        
        # Generate embedding for the text chunk
        try:
            embedding = get_embedding(text_chunk, bedrock_client)
            logger.info("Generated embedding for text chunk")
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            raise
        
        # Prepare document for indexing
        document = {
            'embedding': embedding,
            'text': text_chunk,
            'metadata': {
                'source': metadata.get('source_filename', 'unknown'),
                'source_filename': metadata.get('source_filename', 'unknown'),
                'page_number': metadata.get('page_number'),
                'chunk_id': metadata.get('chunk_id', 0),
                'total_chunks': metadata.get('total_chunks', 1),
                'content_type': 'text',
                'processed_at': context.aws_request_id if context else None
            }
        }
        
        # Index document into OpenSearch
        try:
            response = opensearch_client.index(
                index='rag-index',
                body=document
            )
            
            logger.info(f"Successfully indexed text chunk. Document ID: {response.get('_id')}")
            
            return {
                'statusCode': 200,
                'message': 'Text chunk processed and indexed successfully',
                'document_id': response.get('_id'),
                'chunk_id': metadata.get('chunk_id', 0)
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