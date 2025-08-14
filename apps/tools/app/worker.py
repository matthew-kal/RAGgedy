import sys
import os
import argparse
import json
import uuid
from unstructured.partition.auto import partition
from unstructured.chunking.title import chunk_by_title
from unstructured.elements.composite_text import CompositeText
from unstructured.elements.image import Image
from unstructured.elements.table import Table

os.environ["UNSTRUCTURED_HI_RES_MODEL_NAME"] = "detectron2_onnx"


def process_document(file_path: str, project_id: str, document_id: str):
    """
    Holistically parses a document, separating text, tables, and images,
    and streams the output as line-delimited JSON (ndjson).
    """
    try:
        # Create a dedicated directory for extracted images for this document
        # The path is constructed relative to the document's location
        base_dir = os.path.dirname(os.path.dirname(file_path)) # up to /uploads
        images_dir = os.path.join(base_dir, 'images', document_id)
        os.makedirs(images_dir, exist_ok=True)

        # Use unstructured's partition function with high-res strategies
        elements = partition(
            filename=file_path,
            strategy="hi_res",
            extract_images_in_pdf=True,
            infer_table_structure=True
        )

        text_elements = []
        # First, iterate through elements to handle images and tables separately
        for el in elements:
            if isinstance(el, Image):
                # Save the extracted image with a unique name
                image_path = os.path.join(images_dir, f"{uuid.uuid4()}.jpg")
                el.image.save(image_path)
                
                # Output a JSON line for the image
                print(json.dumps({
                    "type": "image",
                    "saved_path": image_path
                }))
            elif isinstance(el, Table):
                # For tables, get the HTML representation and output it as a table chunk
                table_html = el.metadata.text_as_html
                if table_html:
                    print(json.dumps({
                        "type": "table",
                        "content": table_html,
                        "metadata": {
                            "page_number": el.metadata.page_number or 0
                        }
                    }))
            elif isinstance(el, CompositeText):
                # Collect all other text-based elements for later chunking
                text_elements.append(el)

        # Now, chunk only the collected text elements by title for semantic grouping
        chunks = chunk_by_title(
            elements=text_elements,
            max_characters=2000,
            combine_text_under_n_chars=500
        )

        for i, chunk in enumerate(chunks):
            # Output a JSON line for each text chunk
            print(json.dumps({
                "type": "chunk",
                "index": i,
                "content": chunk.text,
                "metadata": {
                    "page_number": chunk.metadata.page_number or 0
                }
            }))

    except Exception as e:
        # If any error occurs, print a structured error to stderr
        print(json.dumps({"type": "error", "message": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Process a document and stream structured output.')
    parser.add_argument('--document-path', required=True, help='Absolute path to the document file.')
    parser.add_argument('--project-id', required=True, help='The ID of the project.')
    parser.add_argument('--document-id', required=True, help='The ID of the document.')
    args = parser.parse_args()
    
    process_document(args.document_path, args.project_id, args.document_id)