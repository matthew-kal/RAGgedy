# app/worker.py
import os
import uuid
import requests
from unstructured.partition.pdf import partition_pdf
from unstructured.chunking.title import chunk_by_title
from unstructured.elements.image import Image
from unstructured.elements.table import Table

def run_document_processing(job_id, file_path, callback_url):
    """
    This function runs in a separate process to avoid blocking the API.
    """
    print(f"Worker process started for job {job_id} on file {file_path}")
    final_payload = {"jobId": job_id}

    try:
        # --- All the Unstructured logic from before ---
        project_dir = os.path.dirname(os.path.dirname(file_path))
        images_dir = os.path.join(project_dir, "images")
        os.makedirs(images_dir, exist_ok=True)

        elements = partition_pdf(
            filename=file_path,
            extract_images_in_pdf=True,
            strategy="hi_res",
            infer_table_structure=True
        )

        text_elements = []
        extracted_image_paths = []
        for el in elements:
            if isinstance(el, Image):
                image_path = os.path.join(images_dir, f"{uuid.uuid4()}.jpg")
                el.image.save(image_path)
                extracted_image_paths.append(image_path)
            elif isinstance(el, Table):
                el.text = el.metadata.text_as_html
                text_elements.append(el)
            else:
                text_elements.append(el)

        chunks = chunk_by_title(elements=text_elements, max_characters=2000)

        formatted_chunks = [{
            "content": chunk.text,
            "metadata": {"page_number": chunk.metadata.page_number or 0}
        } for chunk in chunks]

        # Prepare the success payload
        final_payload['status'] = 'success'
        final_payload['data'] = {
            "chunks": formatted_chunks,
            "extracted_images": extracted_image_paths
        }

    except Exception as e:
        print(f"ERROR in worker for job {job_id}: {e}")
        # Prepare the error payload
        final_payload['status'] = 'error'
        final_payload['error'] = str(e)

    finally:
        # --- Make the callback to the Node.js server ---
        print(f"Worker for job {job_id} finished. Sending callback to {callback_url}")
        try:
            requests.post(callback_url, json=final_payload, timeout=30)
        except requests.exceptions.RequestException as e:
            print(f"FATAL: Could not send callback for job {job_id}: {e}")