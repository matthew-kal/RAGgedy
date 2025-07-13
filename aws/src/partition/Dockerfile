FROM public.ecr.aws/lambda/python:3.11

# Install system dependencies required for unstructured
RUN yum update -y && \
    yum install -y \
    gcc \
    gcc-c++ \
    make \
    poppler-utils \
    tesseract \
    tesseract-langpack-eng \
    libmagic \
    file \
    && yum clean all

# Copy requirements and install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install --no-cache-dir -r requirements.txt

# Copy function code
COPY handler.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD ["handler.lambda_handler"] 