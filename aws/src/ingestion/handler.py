import json
import os
import boto3
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
from langchain.text_splitter import RecursiveCharacterTextSplitter
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
region = os.environ.get('AWS_REGION', 'us-east-1')
credentials = boto3.Session().get_credentials()
awsauth = AWS4Auth(credentials.access_key, credentials.secret_key, region, 'aoss', session_token=credentials.token)

# Initialize Bedrock client
bedrock_client = boto3.client('bedrock-runtime', region_name=region)

# Initialize OpenSearch client
opensearch_endpoint = os.environ['OPENSEARCH_ENDPOINT']
opensearch_client = OpenSearch(
    hosts=[{'host': opensearch_endpoint.replace('https://', ''), 'port': 443}],
    http_auth=awsauth,
    use_ssl=True,
    verify_certs=True,
    connection_class=RequestsHttpConnection
)

# Initialize text splitter
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=150,
    length_function=len,
)

def get_embedding(text):
    """Generate embedding using Bedrock Titan model"""
    try:
        response = bedrock_client.invoke_model(
            modelId='amazon.titan-embed-text-v1',
            body=json.dumps({
                'inputText': text
            }),
            contentType='application/json'
        )
        
        response_body = json.loads(response['body'].read())
        return response_body['embedding']
    except Exception as e:
        logger.error(f"Error generating embedding: {str(e)}")
        raise

def ensure_index_exists():
    """Create the index if it doesn't exist"""
    index_name = 'rag-index'
    
    if not opensearch_client.indices.exists(index_name):
        index_mapping = {
            'mappings': {
                'properties': {
                    'embedding': {
                        'type': 'knn_vector',
                        'dimension': 1536,  # Titan embedding dimension
                        'method': {
                            'name': 'hnsw',
                            'space_type': 'cosinesimil'
                        }
                    },
                    'text': {
                        'type': 'text'
                    },
                    'metadata': {
                        'type': 'object'
                    }
                }
            },
            'settings': {
                'index': {
                    'knn': True,
                    'number_of_shards': 1,
                    'number_of_replicas': 0
                }
            }
        }
        
        opensearch_client.indices.create(index_name, body=index_mapping)
        logger.info(f"Created index: {index_name}")

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
        
        # Ensure the index exists
        ensure_index_exists()
        
        # Split text into chunks
        chunks = text_splitter.split_text(text)
        logger.info(f"Split text into {len(chunks)} chunks")
        
        # Process each chunk
        documents_indexed = 0
        for i, chunk in enumerate(chunks):
            try:
                # Generate embedding
                embedding = get_embedding(chunk)
                
                # Create document
                document = {
                    'embedding': embedding,
                    'text': chunk,
                    'metadata': {
                        'source': source_name,
                        'chunk_id': i
                    }
                }
                
                # Index document
                response = opensearch_client.index(
                    index='rag-index',
                    body=document,
                    refresh=True
                )
                
                documents_indexed += 1
                logger.info(f"Indexed chunk {i+1}/{len(chunks)}")
                
            except Exception as e:
                logger.error(f"Error processing chunk {i}: {str(e)}")
                continue
        
        logger.info(f"Successfully indexed {documents_indexed} documents")
        
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