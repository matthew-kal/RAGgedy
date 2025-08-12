import { LocalIndex } from 'vectra';
import { pipeline } from '@xenova/transformers';
import path from 'path';
import { promises as fs } from 'fs';

export interface DocumentChunk {
  id: string;
  projectId: string;
  content: string;
  metadata: {
    filename: string;
    chunkIndex: number;
    totalChunks: number;
  };
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

class VectorService {
  private indexes: Map<string, LocalIndex> = new Map();
  private embedder: any = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize the embedding model
      console.log('Initializing embedding model...');
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2', // Lightweight, fast embedding model
        { revision: 'main' }
      );
      
      this.isInitialized = true;
      console.log('Vector service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector service:', error);
      throw error;
    }
  }

  async getOrCreateIndex(projectId: string): Promise<LocalIndex> {
    if (this.indexes.has(projectId)) {
      return this.indexes.get(projectId)!;
    }

    const indexPath = path.resolve(process.cwd(), 'data', projectId, 'vector-index');
    
    // Ensure directory exists
    await fs.mkdir(indexPath, { recursive: true });

    const index = new LocalIndex(indexPath);

    // Check if index exists, if not create it
    if (!(await index.isIndexCreated())) {
      await index.createIndex();
      console.log(`Created new vector index for project: ${projectId}`);
    } else {
      console.log(`Loaded existing vector index for project: ${projectId}`);
    }

    this.indexes.set(projectId, index);
    return index;
  }

  async addDocument(projectId: string, chunks: DocumentChunk[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const index = await this.getOrCreateIndex(projectId);

    for (const chunk of chunks) {
      try {
        // Generate embedding for the chunk content
        const embedding = await this.generateEmbedding(chunk.content);
        
        // Add the chunk to the vector index
        await index.insertItem({
          vector: embedding,
          metadata: {
            id: chunk.id,
            projectId: chunk.projectId,
            content: chunk.content,
            filename: chunk.metadata.filename,
            chunkIndex: chunk.metadata.chunkIndex,
            totalChunks: chunk.metadata.totalChunks
          }
        });

        console.log(`Added chunk ${chunk.id} to vector index`);
      } catch (error) {
        console.error(`Failed to add chunk ${chunk.id}:`, error);
        throw error;
      }
    }
  }

  async searchSimilar(
    projectId: string, 
    query: string, 
    topK: number = 5
  ): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const index = await this.getOrCreateIndex(projectId);
    
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search for similar vectors
      const results = await index.queryItems(queryEmbedding, '', topK);
      
      return results.map(result => ({
        chunk: {
          id: String(result.item.metadata.id),
          projectId: String(result.item.metadata.projectId),
          content: String(result.item.metadata.content),
          metadata: {
            filename: String(result.item.metadata.filename),
            chunkIndex: Number(result.item.metadata.chunkIndex),
            totalChunks: Number(result.item.metadata.totalChunks)
          }
        },
        score: result.score
      }));
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  async deleteDocument(projectId: string, documentId: string): Promise<void> {
    const index = await this.getOrCreateIndex(projectId);
    
    try {
      // Note: Vectra doesn't have built-in metadata filtering for deletion
      // This is a limitation - you might need to rebuild the index
      // or keep track of item IDs separately for deletion
      console.log(`Document deletion requested for ${documentId} in project ${projectId}`);
      console.log('Note: Vectra requires index rebuild for document deletion');
    } catch (error) {
      console.error('Delete failed:', error);
      throw error;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const output = await this.embedder(text, {
        pooling: 'mean',
        normalize: true
      });
      
      return Array.from(output.data);
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw error;
    }
  }

  // Utility function to split text into chunks
  splitTextIntoChunks(
    text: string, 
    chunkSize: number = 500, 
    overlap: number = 50
  ): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Add overlap by starting new chunk with end of previous chunk
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(overlap / 10)).join(' ');
        currentChunk = overlapWords + ' ' + trimmedSentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.filter(chunk => chunk.length > 10); // Filter out very short chunks
  }
}

// Export singleton instance
export const vectorService = new VectorService();
