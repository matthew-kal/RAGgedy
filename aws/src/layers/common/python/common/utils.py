import boto3
import json
import os
import logging
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def create_opensearch_client(opensearch_endpoint):
    """Create and return a configured OpenSearch client"""
    region = os.environ.get('AWS_REGION', 'us-east-1')
    credentials = boto3.Session().get_credentials()
    awsauth = AWS4Auth(credentials.access_key, credentials.secret_key, region, 'aoss', session_token=credentials.token)
    
    client = OpenSearch(
        hosts=[{'host': opensearch_endpoint.replace('https://', ''), 'port': 443}],
        http_auth=awsauth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection
    )
    return client

def create_bedrock_client(region='us-east-1'):
    """Create and return a configured Bedrock client"""
    return boto3.client('bedrock-runtime', region_name=region)

def get_embedding(text, bedrock_client):
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