import json

def handler(event, context):

    print("S3 Event via EventBridge Received")

    try:
        bucket_name = event['detail']['bucket']['name']
        object_key = event['detail']['object']['key']

        print(f"File '{object_key}' was uploaded to bucket '{bucket_name}'.")

    except KeyError:
        print("Could not extract details from event.")
        print("Full event:", json.dumps(event, indent=2))

    return { 'statusCode': 200 }