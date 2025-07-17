import json
import os
import boto3
import logging
from datetime import datetime

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')

def lambda_handler(event, context):
    """Aggregate processing results and save to S3 as JSON"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Get environment variables
        assets_bucket = os.environ['ASSETS_BUCKET']
        
        # Extract the original document key from the event
        # The event structure should contain the original document information
        # This might be in the metadata or passed through the Step Function
        original_document_key = None
        
        # Look for document key in various possible locations
        if 'detail' in event and 'object' in event['detail']:
            original_document_key = event['detail']['object']['key']
        elif 'document_key' in event:
            original_document_key = event['document_key']
        elif 'metadata' in event and 'source_filename' in event['metadata']:
            original_document_key = event['metadata']['source_filename']
        
        if not original_document_key:
            logger.error("Could not determine original document key")
            return {
                'statusCode': 400,
                'error': 'Original document key not found in event'
            }
        
        # Create the output JSON filename
        output_key = f"{original_document_key}.json"
        # Initialize the final JSON structure
        final_json = {
            'text_chunks': [],
            'images': [],
            'metadata': {
                'original_document': original_document_key,
                'processed_at': datetime.utcnow().isoformat(),
                'processing_id': context.aws_request_id if context else None
            }
        }
        
        # Process the parallel results
        # The event should contain the results from both text and image processing
        if 'ProcessedData' in event:
            processed_data = event['ProcessedData']
            
            # Process text chunks
            if 'texts' in processed_data:
                for text_result in processed_data['texts']:
                    if isinstance(text_result, list):
                        # Handle case where texts is a list of results
                        for item in text_result:
                            if item.get('statusCode') == 200:
                                final_json['text_chunks'].append({
                                    'text': item.get('text', ''),
                                    'metadata': item.get('metadata', {}),
                                    'content_type': item.get('content_type', 'text')
                                })
                    else:
                        # Handle case where texts is a single result
                        if text_result.get('statusCode') == 200:
                            final_json['text_chunks'].append({
                                'text': text_result.get('text', ''),
                                'metadata': text_result.get('metadata', {}),
                                'content_type': text_result.get('content_type', 'text')
                            })
            
            # Process images
            if 'images' in processed_data:
                for image_result in processed_data['images']:
                    if isinstance(image_result, list):
                        # Handle case where images is a list of results
                        for item in image_result:
                            if item.get('statusCode') == 200:
                                final_json['images'].append({
                                    'image_s3_uri': item.get('image_s3_uri', ''),
                                    'llm_generated_description': item.get('llm_generated_description', ''),
                                    'metadata': item.get('metadata', {}),
                                    'content_type': item.get('content_type', 'image'),
                                    'image_content_type': item.get('image_content_type', '')
                                })
                    else:
                        # Handle case where images is a single result
                        if image_result.get('statusCode') == 200:
                            final_json['images'].append({
                                'image_s3_uri': image_result.get('image_s3_uri', ''),
                                'llm_generated_description': image_result.get('llm_generated_description', ''),
                                'metadata': image_result.get('metadata', {}),
                                'content_type': image_result.get('content_type', 'image'),
                                'image_content_type': image_result.get('image_content_type', '')
                            })
        
        logger.info(f"Aggregated {len(final_json['text_chunks'])} text chunks and {len(final_json['images'])} images")
        
        # Save the final JSON to S3
        try:
            s3_client.put_object(
                Bucket=assets_bucket,
                Key=output_key,
                Body=json.dumps(final_json, indent=2),
                ContentType='application/json'
            )
            
            logger.info(f"Successfully saved aggregated results to s3://{assets_bucket}/{output_key}")
            
            return {
                'statusCode': 200,
                'message': 'Results aggregated and saved successfully',
                'output_location': f"s3://{assets_bucket}/{output_key}",
                'text_chunks_count': len(final_json['text_chunks']),
                'images_count': len(final_json['images'])
            }
            
        except Exception as e:
            logger.error(f"Error saving to S3: {str(e)}")
            raise
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        return {
            'statusCode': 500,
            'error': f'Internal server error: {str(e)}'
        } 