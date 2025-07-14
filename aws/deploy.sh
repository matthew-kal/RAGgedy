#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "Building SAM application..."
# The --use-container flag ensures that Python dependencies are built in a
# clean, Lambda-like Docker environment, which is crucial for consistency.
# It will also build the Docker image for the PartitioningFunction.
sam build --use-container

echo "Deploying SAM application..."
# The --guided flag will walk you through the initial deployment setup,
# asking for parameters like Stack Name and Region, and then saving them
# to a samconfig.toml file for future, non-guided deployments.
sam deploy --guided --debug