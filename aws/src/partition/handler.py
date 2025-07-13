import json
import os
import boto3
import logging
from io import BytesIO
from urllib.parse import unquote
from unstructured.partition.auto import partition
from langchain.text_splitter import RecursiveCharacterTextSplitter
from botocore.exceptions import ClientError

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
region = os.environ.get('AWS_REGION', 'us-east-2')

# Initialize text splitter
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=150,
    length_function=len,
)

def lambda_handler(event, context):
    """Partition document and extract text chunks and images"""
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Get bucket and key from event
        bucket_name = event.get('bucket')
        object_key = event.get('key')
        
        if not bucket_name or not object_key:
            raise ValueError("bucket and key are required")
        
        # URL decode the key if needed
        object_key = unquote(object_key)
        
        logger.info(f"Processing file: {object_key} from bucket: {bucket_name}")
        
        # Download file from S3
        try:
            response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            file_content = response['Body'].read()
            logger.info(f"Downloaded {len(file_content)} bytes from S3")
        except ClientError as e:
            logger.error(f"Error downloading file from S3: {str(e)}")
            raise
        
        # Get file extension for processing
        file_extension = os.path.splitext(object_key)[1].lower()
        
        # Create temporary file for unstructured processing
        temp_file_path = f"/tmp/{os.path.basename(object_key)}"
        with open(temp_file_path, 'wb') as f:
            f.write(file_content)
        
        # Partition the document using unstructured
        try:
            elements = partition(filename=temp_file_path)
            logger.info(f"Partitioned document into {len(elements)} elements")
        except Exception as e:
            logger.error(f"Error partitioning document: {str(e)}")
            raise
        
        # Process elements
        text_elements = []
        image_elements = []
        
        for i, element in enumerate(elements):
            try:
                # Handle text elements
                if hasattr(element, 'text') and element.text.strip():
                    text_elements.append({
                        'text': element.text.strip(),
                        'element_type': str(type(element).__name__),
                        'page_number': getattr(element.metadata, 'page_number', None) if hasattr(element, 'metadata') else None,
                        'element_id': i
                    })
                
                # Handle image elements (if any)
                elif hasattr(element, 'metadata') and hasattr(element.metadata, 'image_path'):
                    # This is a placeholder - actual image handling depends on unstructured version
                    # For now, we'll skip image elements as they're not commonly extracted this way
                    pass
                    
            except Exception as e:
                logger.warning(f"Error processing element {i}: {str(e)}")
                continue
        
        logger.info(f"Extracted {len(text_elements)} text elements")
        
        # Combine all text and split into chunks
        full_text = '\n\n'.join([elem['text'] for elem in text_elements])
        
        if not full_text.strip():
            logger.warning("No text content found in document")
            return {
                'texts': [],
                'images': []
            }
        
        # Split text into chunks
        chunks = text_splitter.split_text(full_text)
        logger.info(f"Split text into {len(chunks)} chunks")
        
        # Create text objects with metadata
        text_objects = []
        for i, chunk in enumerate(chunks):
            text_obj = {
                'text': chunk,
                'metadata': {
                    'source_filename': os.path.basename(object_key),
                    'page_number': None,  # Will be populated from element metadata if available
                    'chunk_id': i,
                    'total_chunks': len(chunks)
                }
            }
            text_objects.append(text_obj)
        
        # For now, return empty images array as image processing is complex
        # In a full implementation, you'd extract images and upload them to AssetsBucket
        image_s3_uris = []
        
        # Clean up temporary file
        try:
            os.remove(temp_file_path)
        except:
            pass
        
        result = {
            'texts': text_objects,
            'images': image_s3_uris
        }
        
        logger.info(f"Returning {len(text_objects)} text objects and {len(image_s3_uris)} image URIs")
        return result
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {str(e)}")
        # Clean up temporary file on error
        try:
            os.remove(temp_file_path)
        except:
            pass
        raise 