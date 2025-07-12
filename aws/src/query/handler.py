import json
import os
import boto3
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
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

def search_similar_documents(query_embedding, k=5):
    """Search for similar documents in OpenSearch"""
    try:
        search_query = {
            "size": k,
            "query": {
                "knn": {
                    "embedding": {
                        "vector": query_embedding,
                        "k": k
                    }
                }
            },
            "_source": ["text", "metadata"]
        }
        
        response = opensearch_client.search(
            index='rag-index',
            body=search_query
        )
        
        results = []
        for hit in response['hits']['hits']:
            results.append({
                'text': hit['_source']['text'],
                'metadata': hit['_source']['metadata'],
                'score': hit['_score']
            })
        
        return results
    except Exception as e:
        logger.error(f"Error searching documents: {str(e)}")
        return []

def generate_response(query, context_docs):
    """Generate response using Bedrock Claude model"""
    try:
        # Build context from retrieved documents
        context = "\n\n".join([f"Source: {doc['metadata']['source']}\nContent: {doc['text']}" for doc in context_docs])
        
        # Construct prompt
        prompt = f"""You are a helpful AI assistant. Answer the user's question based ONLY on the provided context below. If you cannot answer the question based on the context, please say so.

Context:
{context}

Question: {query}

Answer:"""

        # Call Claude model
        response = bedrock_client.invoke_model(
            modelId='anthropic.claude-3-haiku-20240307-v1:0',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1000,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }),
            contentType='application/json'
        )
        
        response_body = json.loads(response['body'].read())
        return response_body['content'][0]['text']
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        return "I'm sorry, I encountered an error while generating the response."

def lambda_handler(event, context):
    """Handle the query request"""
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
            
        query = body.get('query', '')
        
        if not query:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Query is required'})
            }
        
        # Generate embedding for the query
        query_embedding = get_embedding(query)
        logger.info("Generated query embedding")
        
        # Search for similar documents
        similar_docs = search_similar_documents(query_embedding)
        logger.info(f"Found {len(similar_docs)} similar documents")
        
        if not similar_docs:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'response': 'I could not find any relevant information in the knowledge base to answer your question.',
                    'sources': []
                })
            }
        
        # Generate response using retrieved context
        ai_response = generate_response(query, similar_docs)
        logger.info("Generated AI response")
        
        # Format sources for frontend
        sources = []
        for doc in similar_docs:
            sources.append({
                'filename': doc['metadata']['source'],
                'text': doc['text'],
                'score': doc['score']
            })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'response': ai_response,
                'sources': sources
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