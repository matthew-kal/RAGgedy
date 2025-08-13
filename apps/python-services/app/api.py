# app/api.py
from flask import Flask, request, jsonify
from multiprocessing import Process
from .worker import run_document_processing
import os

app = Flask(__name__)

# Load Node.js callback URL from environment variables for security
NODE_CALLBACK_URL = os.getenv("NODE_CALLBACK_URL", "http://localhost:3000/jobs/callback")

@app.route('/process-document', methods=['POST'])
def process_document_endpoint():
    data = request.get_json()
    if not data or 'filePath' not in data or 'jobId' not in data:
        return jsonify({"error": "filePath and jobId are required"}), 400

    job_id = data['jobId']
    file_path = data['filePath']

    if not os.path.exists(file_path):
        return jsonify({"error": "File not found on the server"}), 404

    # Spawn a new process to do the heavy work in the background.
    # The 'target' is the function we want to run, and 'args' are its arguments.
    worker_process = Process(
        target=run_document_processing,
        args=(job_id, file_path, NODE_CALLBACK_URL)
    )
    worker_process.start()

    # Immediately confirm that the job has been accepted for processing.
    return jsonify({
        "status": "processing_started",
        "message": f"Job {job_id} started in the background."
    }), 202