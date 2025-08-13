import { connect, Connection, Table } from '@lancedb/lancedb';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import path from 'path';
import type { Chunk } from 'shared-types';



export interface SearchResult {
  chunk: Chunk['metadata'] & { content: string };
  score: number;
}

class VectorService {
  private dbConnection: Connection | null = null;
  private tables: Map<string, Table> = new Map();
  private embedder: FeatureExtractionPipeline | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing embedding model and DB connection...');
      // Initialize the embedding model
      this.embedder = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      );

      // Connect to the LanceDB database directory
      const dbPath = path.resolve(process.cwd(), 'data', 'lancedb');
      this.dbConnection = await connect(dbPath);

      this.isInitialized = true;
      console.log('Vector service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize vector service:', error);
      throw error;
    }
  }

  // A project's "index" is now a "table" in LanceDB
  async getOrCreateTable(projectId: string): Promise<Table> {
    if (this.tables.has(projectId)) {
      return this.tables.get(projectId)!;
    }
    if (!this.dbConnection) throw new Error('Database connection not initialized.');

    const tableName = `project_${projectId.replace(/-/g, '_')}`;
    const tableNames = await this.dbConnection.tableNames();

    if (tableNames.includes(tableName)) {
      console.log(`Opening existing table: ${tableName}`);
      const table = await this.dbConnection.openTable(tableName);
      this.tables.set(projectId, table);
      return table;
    } else {
      console.log(`Creating new table: ${tableName}`);
      // The first item added to a table defines its schema.
      // We pass a dummy object to create the table with the right structure.
      const table = await this.dbConnection.createTable(tableName, [
        { vector: Array(384).fill(0), content: 'dummy', source_file: '', page_number: 0, chunk_index: 0, id: '' }
      ]);
      this.tables.set(projectId, table);
      return table;
    }
  }

  async addDocuments(projectId: string, chunks: Chunk[]): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    const table = await this.getOrCreateTable(projectId);
    if (chunks.length === 0) return;

    const data = [];
    for (const chunk of chunks) {
      const embedding = await this.generateEmbedding(chunk.content);
      data.push({
        vector: embedding,
        id: chunk.id,
        content: chunk.content,
        source_file: chunk.metadata.source_file,
        page_number: chunk.metadata.page_number,
        chunk_index: chunk.metadata.chunk_index,
        user_description: chunk.metadata.user_description,
        keywords: chunk.metadata.keywords
      });
    }

    await table.add(data);
    console.log(`Added ${data.length} chunks to table for project: ${projectId}`);
  }

  async search(
    projectId: string,
    query: string,
    filter: string = '', // SQL-like WHERE clause, e.g., "page_number > 15 AND keywords LIKE '%finance%'"
    topK: number = 5
  ): Promise<SearchResult[]> {
    if (!this.isInitialized) await this.initialize();

    const table = await this.getOrCreateTable(projectId);
    const queryEmbedding = await this.generateEmbedding(query);

    let queryBuilder = table.search(queryEmbedding, 'vector').limit(topK);

    if (filter) {
      queryBuilder = queryBuilder.where(filter);
    }

    const results = await queryBuilder.toArray();

    return results.map(result => ({
      // Note: lancedb returns all metadata fields at the top level
      chunk: {
        content: result.content as string,
        source_file: result.source_file as string,
        page_number: result.page_number as number,
        chunk_index: result.chunk_index as number,
        user_description: result.user_description as string | undefined,
        keywords: result.keywords as string[] | undefined,
      },
      score: result._distance || 0 // LanceDB uses _distance for similarity scores
    }));
  }

  async deleteDocument(projectId: string, sourceFile: string): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    const table = await this.getOrCreateTable(projectId);
    // LanceDB can delete based on a metadata filter, solving the old problem.
    await table.delete(`source_file = '${sourceFile}'`);
    console.log(`Deleted all chunks for document '${sourceFile}' in project ${projectId}`);
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) throw new Error("Embedder not initialized.");
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

  // Utility function for chunking - can be moved to a separate service later
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
      if ((currentChunk.length + trimmedSentence.length + 1) > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        const overlapWords = currentChunk.split(' ').slice(-Math.floor(overlap / 5)).join(' ');
        currentChunk = overlapWords + '. ' + trimmedSentence;
      } else {
        currentChunk += (currentChunk.length > 0 ? '. ' : '') + trimmedSentence;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    return chunks;
  }
}

export const vectorService = new VectorService();