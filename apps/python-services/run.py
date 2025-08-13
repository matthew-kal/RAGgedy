# run.py
from app.api import app
import os

# Set UNSTRUCTURED_HI_RES_MODEL_NAME here or in your .env file
os.environ["UNSTRUCTURED_HI_RES_MODEL_NAME"] = "detectron2_onnx"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)