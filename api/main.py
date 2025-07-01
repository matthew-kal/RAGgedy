# main.py
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import openai

# Import LlamaIndex components
from llama_index.core import StorageContext, VectorStoreIndex, Document
from llama_index.vector_stores.chroma import ChromaVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI

# Import ChromaDB client
import chromadb

# --- 0. Logging Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- 1. Configuration and Global Variables ---
logger.info("Starting up the Context Engine Backend...")
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS middleware configured.")

if not os.getenv("OPENAI_API_KEY"):
    logger.error("FATAL: OPENAI_API_KEY environment variable not set.")
    raise RuntimeError("OPENAI_API_KEY environment variable not set.")

CHROMA_HOST = "database"
CHROMA_PORT = 8000
CHROMA_COLLECTION = "context_engine_db"
logger.info(f"Database configuration set for host: {CHROMA_HOST}, collection: {CHROMA_COLLECTION}")

# --- 2. Initialize Core Components (Done Once on Startup) ---
try:
    logger.info("Initializing ChromaDB client...")
    client = chromadb.HttpClient(host=CHROMA_HOST, port=CHROMA_PORT)
    logger.info("Successfully connected to ChromaDB.")

    logger.info(f"Getting or creating collection: {CHROMA_COLLECTION}")
    collection = client.get_or_create_collection(CHROMA_COLLECTION)
    logger.info("ChromaDB collection is ready.")

    logger.info("Initializing LlamaIndex components...")
    vector_store = ChromaVectorStore(chroma_collection=collection)
    embed_model = OpenAIEmbedding(model="text-embedding-3-small")
    llm = OpenAI(model="gpt-4o")
    
    logger.info("Creating main index object from vector store...")
    index = VectorStoreIndex.from_vector_store(
        vector_store=vector_store,
        embed_model=embed_model,
    )
    logger.info("Core components initialized successfully. Application is ready.")

except Exception as e:
    logger.critical(f"Failed to initialize core components: {e}", exc_info=True)
    raise

# --- 3. API Endpoints ---

class ContextRequest(BaseModel):
    text: str
    source_name: str

class QueryRequest(BaseModel):
    query: str

@app.post("/add-context")
async def add_context(req: ContextRequest):
    logger.info(f"Received context submission for source: '{req.source_name}'")
    if not req.text or not req.source_name:
        raise HTTPException(status_code=400, detail="Text and source_name cannot be empty.")

    try:
        logger.info("Creating LlamaIndex document from text.")
        doc = Document(text=req.text, metadata={"filename": req.source_name})
        
        logger.info(f"Starting indexing for source: {req.source_name}")
        index.insert(document=doc)
        logger.info(f"Successfully indexed source: {req.source_name}")

        return {"success": True, "message": f"Context from '{req.source_name}' added successfully."}
    
    except openai.RateLimitError as e:
        logger.error(f"OpenAI Rate Limit Error for '{req.source_name}': {e}")
        raise HTTPException(status_code=429, detail="OpenAI API error: Rate limit exceeded. Please wait and try again.")
    except openai.AuthenticationError as e:
        logger.error(f"OpenAI Authentication Error for '{req.source_name}': {e}")
        raise HTTPException(status_code=401, detail="OpenAI API error: Invalid API key.")
    except openai.PermissionDeniedError as e:
        logger.error(f"OpenAI Permission/Quota Error for '{req.source_name}': {e}")
        raise HTTPException(status_code=429, detail="OpenAI API error: Insufficient quota. Please check your plan and billing details.")
    except Exception as e:
        logger.error(f"Failed to add context for source '{req.source_name}'. Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@app.post("/query")
async def query_rag(req: QueryRequest):
    try:
        logger.info(f"Received query: '{req.query}'")
        
        logger.info("Creating query engine...")
        # Configure the query engine to retrieve the top 3 most similar chunks.
        query_engine = index.as_query_engine(
            llm=llm,
            similarity_top_k=3 
        )
        logger.info("Query engine created successfully.")
        
        logger.info("Executing query...")
        result = query_engine.query(req.query)
        logger.info("Query executed successfully.")

        # --- MODIFIED SECTION: Extracting Detailed Source Information ---
        sources = []
        for node in result.source_nodes:
            filename = node.metadata.get("filename", "Unknown Source")
            chunk_text = node.get_content()
            score = node.get_score() # Get the relevance score for the chunk
            sources.append({
                "filename": filename,
                "text": chunk_text,
                "score": score
            })
            logger.info(f"Retrieved chunk from '{filename}' with score: {score:.4f}")

        return {"response": str(result), "sources": sources}
        
    except openai.RateLimitError as e:
        logger.error(f"OpenAI Rate Limit Error during query: {e}")
        raise HTTPException(status_code=429, detail="OpenAI API error: Rate limit exceeded. Please wait and try again.")
    except openai.AuthenticationError as e:
        logger.error(f"OpenAI Authentication Error during query: {e}")
        raise HTTPException(status_code=401, detail="OpenAI API error: Invalid API key.")
    except openai.PermissionDeniedError as e:
        logger.error(f"OpenAI Permission/Quota Error during query: {e}")
        raise HTTPException(status_code=429, detail="OpenAI API error: Insufficient quota. Please check your plan and billing details.")
    except Exception as e:
        logger.error(f"Query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@app.get("/")
def read_root():
    logger.info("Root endpoint was hit. Health check successful.")
    return {"message": "Context Engine Backend is running!"}
