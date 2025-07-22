# Use the official, more robust Python 3.10 slim image as our base
FROM python:3.10-slim-bullseye

# Set the working directory using the standard Lambda path
WORKDIR /var/task

# Install Tesseract, Poppler, and other system dependencies using apt-get
RUN apt-get update && \
    apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file
COPY requirements.txt .

# Install the AWS Lambda Runtime Interface Client (RIC) and Python dependencies
RUN pip install --no-cache-dir awslambdaric && \
    pip install --no-cache-dir -r requirements.txt

# Copy the function handler code
COPY handler.py .

# Set the entry point to the Lambda Runtime Interface Client
ENTRYPOINT [ "/usr/local/bin/python", "-m", "awslambdaric" ]

# Set the command to the function handler
CMD [ "handler.lambda_handler" ]