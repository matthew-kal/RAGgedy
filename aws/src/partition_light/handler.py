import json
import os
import boto3
import logging
from io import BytesIO
from urllib.parse import unquote
from unstructured.partition.auto import partition
from langchain_text_splitters import RecursiveCharacterTextSplitter
from botocore.exceptions import ClientError
import uuid

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
region = os.environ.get('AWS_REGION', 'us-east-2')
assets_bucket = os.environ['ASSETS_BUCKET']

# Initialize text splitter
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=150,
    length_function=len,
)

def lambda_handler(event, context):
    """Lightweight document partition for simple documents (no detectron2)"""
    try:
        logger.info(f"Light partition received event: {json.dumps(event)}")
        
        # Get bucket and key from event
        bucket_name = event.get('bucket')
        object_key = event.get('key')
        analysis = event.get('analysis', {})
        
        if not bucket_name or not object_key:
            raise ValueError("bucket and key are required")
        
        # URL decode the key if needed
        object_key = unquote(object_key)
        
        logger.info(f"Light processing file: {object_key} from bucket: {bucket_name}")
        logger.info(f"Analysis result: {analysis}")
        
        # Download file from S3
        try:
            response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            file_content = response['Body'].read()
            logger.info(f"Downloaded {len(file_content)} bytes from S3")
        except ClientError as e:
            logger.error(f"Error downloading file from S3: {str(e)}")
            raise
        
        # Create temporary file for unstructured processing
        temp_file_path = f"/tmp/{os.path.basename(object_key)}"
        with open(temp_file_path, 'wb') as f:
            f.write(file_content)
        
        # Partition the document using unstructured (basic mode)
        try:
            # Use basic partitioning without advanced ML models
            elements = partition(
                filename=temp_file_path,
                # Disable advanced features that require heavy dependencies
                include_page_breaks=False,
                infer_table_structure=False,  # No table detection
                strategy="fast"  # Use fast strategy for simple docs
            )
            logger.info(f"Light partitioned document into {len(elements)} elements")
        except Exception as e:
            logger.error(f"Error partitioning document: {str(e)}")
            raise
        
        # Process elements (text only for light processing)
        text_elements = []
        
        for i, element in enumerate(elements):
            try:
                if hasattr(element, 'text') and element.text.strip():
                    text_elements.append({
                        'text': element.text.strip(),
                        'metadata': {
                            'page_number': getattr(element.metadata, 'page_number', None),
                            'element_type': str(type(element).__name__),
                            'element_id': i,
                            'processing_tier': 'light'
                        }
                    })
            except Exception as e:
                logger.warning(f"Error processing element {i}: {str(e)}")
                continue
        
        logger.info(f"Extracted {len(text_elements)} text elements")
        
        # Process text chunks with preserved metadata
        text_objects = []
        for elem in text_elements:
            chunks = text_splitter.split_text(elem['text'])
            for j, chunk in enumerate(chunks):
                text_obj = {
                    'text': chunk,
                    'metadata': {
                        'source_filename': os.path.basename(object_key),
                        'page_number': elem['metadata']['page_number'],
                        'chunk_id': j,
                        'total_chunks': len(chunks),
                        'original_element_id': elem['metadata']['element_id'],
                        'processing_tier': 'light',
                        'complexity_analysis': analysis
                    }
                }
                text_objects.append(text_obj)
        
        # Clean up temporary file
        try:
            os.remove(temp_file_path)
        except:
            pass
        
        result = {
            'texts': text_objects,
            'images': [],  # Light processing doesn't extract images
            'processing_tier': 'light',
            'analysis': analysis
        }
        
        logger.info(f"Light processing complete: {len(text_objects)} text objects")
        return result
        
    except Exception as e:
        logger.error(f"Error in light partition lambda: {str(e)}")
        # Clean up temporary file on error
        try:
            os.remove(temp_file_path)
        except:
            pass
        raise 