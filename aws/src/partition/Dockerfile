FROM public.ecr.aws/lambda/python:3.10

# Install system dependencies for document processing and build tools
RUN yum update -y && \
    yum install -y \
    gcc \
    gcc-c++ \
    make \
    cmake \
    git \
    ninja-build \
    poppler-utils \
    tesseract \
    tesseract-langpack-eng \
    libmagic \
    file \
    && yum clean all

# Copy requirements.txt
COPY requirements.txt ${LAMBDA_TASK_ROOT}

# Install basic dependencies first including wheel for building
RUN pip install --no-cache-dir --upgrade pip wheel setuptools

# Install core dependencies
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu \
    torch torchvision matplotlib numpy pillow

# Install the remaining dependencies 
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your function code
COPY handler.py ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler
CMD ["handler.lambda_handler"]