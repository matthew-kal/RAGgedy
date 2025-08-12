import { FastifyInstance } from 'fastify';
import { vectorService, DocumentChunk } from '../services/vectorService';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export async function documentRoutes(server: FastifyInstance) {
  // Initialize vector service on server start
  server.addHook('onReady', async () => {
    await vectorService.initialize();
  });

  /**
   * Upload and process a document for a project
   */
  server.post<{
    Params: { projectId: string };
    Body: { filename: string; content: string };
  }>('/projects/:projectId/documents', async (request, reply) => {
    const { projectId } = request.params;
    const { filename, content } = request.body;

    if (!filename || !content) {
      return reply.code(400).send({ 
        error: 'Filename and content are required' 
      });
    }

    try {
      // Split document into chunks
      const textChunks = vectorService.splitTextIntoChunks(content);
      console.log('textChunks', textChunks);
      
      // Create document chunks with metadata
      const documentChunks: DocumentChunk[] = textChunks.map((chunk: string, index: number) => ({
        id: randomUUID(),
        projectId,
        content: chunk,
        metadata: {
          filename,
          chunkIndex: index,
          totalChunks: textChunks.length
        }
      }));

      console.log('documentChunks', documentChunks);

      // Add chunks to vector database
      await vectorService.addDocument(projectId, documentChunks);

      // Save original document to file system
      const projectPath = path.resolve(process.cwd(), 'data', projectId);
      const documentsPath = path.join(projectPath, 'documents');
      await fs.mkdir(documentsPath, { recursive: true });
      
      const documentPath = path.join(documentsPath, `${filename}.txt`);
      await fs.writeFile(documentPath, content, 'utf-8');

      return reply.code(201).send({
        message: 'Document processed successfully',
        filename,
        chunksCreated: documentChunks.length,
        documentId: randomUUID()
      });

    } catch (error: any) {
      server.log.error(error, 'Failed to process document');
      return reply.code(500).send({ 
        error: 'Failed to process document',
        details: error.message 
      });
    }
  });

  /**
   * Query documents using RAG (Retrieval Augmented Generation)
   */
  server.post<{
    Params: { projectId: string };
    Body: { query: string; topK?: number };
  }>('/projects/:projectId/query', async (request, reply) => {
    const { projectId } = request.params;
    const { query, topK = 5 } = request.body;

    if (!query) {
      return reply.code(400).send({ 
        error: 'Query is required' 
      });
    }

    try {
      // Search for relevant document chunks
      const results = await vectorService.searchSimilar(projectId, query, topK);

      if (results.length === 0) {
        return reply.send({
          answer: "I couldn't find any relevant information in your documents to answer that question.",
          sources: [],
          query
        });
      }

      // Extract relevant context from search results
      const context = results
        .map(result => result.chunk.content)
        .join('\n\n');

      // For now, return a simple response with context
      // TODO: Integrate with an LLM for better responses
      const response = {
        answer: `Based on your documents, here's what I found:\n\n${context}`,
        sources: results.map(result => ({
          filename: result.chunk.metadata.filename,
          chunkIndex: result.chunk.metadata.chunkIndex,
          score: result.score,
          preview: result.chunk.content.substring(0, 200) + '...'
        })),
        query,
        foundResults: results.length
      };

      return reply.send(response);

    } catch (error: any) {
      server.log.error(error, 'Failed to query documents');
      return reply.code(500).send({ 
        error: 'Failed to query documents',
        details: error.message 
      });
    }
  });

  /**
   * Get list of documents for a project
   */
  server.get<{
    Params: { projectId: string };
  }>('/projects/:projectId/documents', async (request, reply) => {
    const { projectId } = request.params;

    try {
      const projectPath = path.resolve(process.cwd(), 'data', projectId);
      const documentsPath = path.join(projectPath, 'documents');

      // Check if documents directory exists
      try {
        await fs.access(documentsPath);
      } catch {
        return reply.send({ documents: [] });
      }

      // Read all document files
      const files = await fs.readdir(documentsPath);
      const documents = [];

      for (const file of files) {
        if (path.extname(file) === '.txt') {
          const filePath = path.join(documentsPath, file);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          
          documents.push({
            filename: path.basename(file, '.txt'),
            size: stats.size,
            uploadedAt: stats.mtime.toISOString(),
            wordCount: content.split(/\s+/).length,
            preview: content.substring(0, 200) + (content.length > 200 ? '...' : '')
          });
        }
      }

      return reply.send({ documents });

    } catch (error: any) {
      server.log.error(error, 'Failed to get documents');
      return reply.code(500).send({ 
        error: 'Failed to get documents',
        details: error.message 
      });
    }
  });

  /**
   * Delete a document from a project
   */
  server.delete<{
    Params: { projectId: string; filename: string };
  }>('/projects/:projectId/documents/:filename', async (request, reply) => {
    const { projectId, filename } = request.params;

    try {
      const projectPath = path.resolve(process.cwd(), 'data', projectId);
      const documentPath = path.join(projectPath, 'documents', `${filename}.txt`);

      // Delete the file
      await fs.unlink(documentPath);

      // Note: Vector database cleanup would need to be implemented
      // Vectra doesn't support easy deletion by metadata
      console.log(`Document ${filename} deleted from project ${projectId}`);
      console.log('Note: Vector index cleanup not implemented yet');

      return reply.send({ 
        message: 'Document deleted successfully',
        filename 
      });

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return reply.code(404).send({ 
          error: 'Document not found' 
        });
      }

      server.log.error(error, 'Failed to delete document');
      return reply.code(500).send({ 
        error: 'Failed to delete document',
        details: error.message 
      });
    }
  });
}
