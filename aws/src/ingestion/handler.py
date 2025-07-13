import json
import os
from langchain.text_splitter import RecursiveCharacterTextSplitter
from opensearchpy.helpers import bulk
import logging
from common.utils import create_opensearch_client, create_bedrock_client, get_embedding

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients using shared utilities
opensearch_endpoint = os.environ['OPENSEARCH_ENDPOINT']
opensearch_client = create_opensearch_client(opensearch_endpoint)
bedrock_client = create_bedrock_client()

# Initialize text splitter
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=150,
    length_function=len,
)

def lambda_handler(event, context):
    """Handle the ingestion request"""
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
            
        text = body.get('text', '')
        source_name = body.get('source_name', '')
        
        if not text or not source_name:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Both text and source_name are required'})
            }
        
        # Split text into chunks
        chunks = text_splitter.split_text(text)
        logger.info(f"Split text into {len(chunks)} chunks")
        
        # Prepare actions for bulk indexing
        actions = []
        for i, chunk in enumerate(chunks):
            try:
                # Generate embedding
                embedding = get_embedding(chunk, bedrock_client)
                
                # Create action for bulk indexing
                action = {
                    "_op_type": "index",
                    "_index": "rag-index",
                    "_source": {
                        'embedding': embedding,
                        'text': chunk,
                        'metadata': {
                            'source': source_name,
                            'chunk_id': i
                        }
                    }
                }
                actions.append(action)
                
                logger.info(f"Prepared chunk {i+1}/{len(chunks)} for indexing")
                
            except Exception as e:
                logger.error(f"Error processing chunk {i}: {str(e)}")
                continue
        
        # Bulk index all documents
        documents_indexed = 0
        if actions:
            success, failed = bulk(opensearch_client, actions)
            documents_indexed = success
            logger.info(f"Successfully indexed {success} documents.")
            if failed:
                logger.warning(f"Failed to index {len(failed)} documents.")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'Successfully added context.',
                'chunks_processed': documents_indexed
            })
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