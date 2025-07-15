FROM public.ecr.aws/lambda/python:3.10

# Install system dependencies for document processing and minimal build tools
RUN yum update -y && \
    yum install -y \
    gcc \
    gcc-c++ \
    poppler-utils \
    tesseract \
    tesseract-langpack-eng \
    libmagic \
    file \
    && yum clean all

# Copy requirements.txt (do this before installing to leverage Docker cache)
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# First, install torch as a standalone dependency
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu torch torchvision

# Second, install the rest of the packages from your requirements file
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your function code
COPY handler.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD ["handler.lambda_handler"]