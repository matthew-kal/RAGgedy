import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { jobService } from '../services/jobService.js';
import { vectorService } from '../services/vectorService.js';
import type { DocumentsTable } from '../db/schema.js';
import type { Chunk } from 'shared-types';

interface UploadDocumentRequest {
  filePath: string;
  description: string;
  keywords: string[];
}

export async function documentRoutes(server: FastifyInstance) {
  // Initialize vector service on server start
  server.addHook('onReady', async () => {
   await vectorService.initialize();
  });

  // Copy a local file into project directory and create an ingestion job
  server.post<{ 
    Params: { projectId: string };
    Body: UploadDocumentRequest;
  }>(
    '/projects/:projectId/documents',
    // This is the new function body for the POST route
async (request, reply) => {
  const { projectId } = request.params;
  const { filePath, fileName, description, keywords } = request.body as any; // Cast as any to match new body

  if (!filePath || !fileName) {
    return reply.code(400).send({ error: 'filePath and fileName are required.' });
  }

  try {
    const documentId = randomUUID();
    const fileType = fileName.split('.').pop()?.toLowerCase() as DocumentsTable['fileType'] || 'txt';

    await db.insertInto('documents').values({
      id: documentId,
      fileName: fileName,
      filePath: filePath,
      fileType: fileType,
      status: 'queued',
      createdAt: new Date().toISOString(),
      user_description: description,
      keywords: JSON.stringify(keywords),
    }).execute();

    await db.insertInto('project_documents').values({
      projectId,
      documentId,
    }).execute();

    await jobService.createIngestionJob(documentId);

    return reply.code(202).send({
      message: 'Document accepted and queued for processing.',
      documentId: documentId
    });

  } catch (error: any) {
    server.log.error(error, 'Failed to create document record');
    return reply.code(500).send({ error: 'An unexpected error occurred.' });
  }
}
  );

  /**
   * STEP 5: New endpoint for Python worker to call upon completion.
   */
  server.post<{ Body: { jobId: string; status: 'success' | 'error'; data?: any; error?: string } }>(
    '/jobs/callback',
    async (request, reply) => {
      const { jobId, status, data, error } = request.body;

      const job = await db.selectFrom('jobs').selectAll().where('id', '=', jobId).executeTakeFirst();
      if (!job) return reply.code(404).send({ error: 'Job not found' });

      const document = await db.selectFrom('documents').selectAll().where('id', '=', job.relatedId).executeTakeFirst();
      if (!document) return reply.code(404).send({ error: 'Associated document not found' });

      if (status === 'error') {
        await db.updateTable('jobs').set({ status: 'failed' }).where('id', '=', jobId).execute();
        await db.updateTable('documents').set({ status: 'error' }).where('id', '=', document.id).execute();
        server.log.error(`Job ${jobId} failed: ${error}`);
        return reply.code(200).send({ message: 'Job failure acknowledged' });
      }

      try {
        // Get the project IDs this document belongs to
        const projectRelations = await db
          .selectFrom('project_documents')
          .select(['projectId'])
          .where('documentId', '=', document.id)
          .execute();

        if (projectRelations.length === 0) {
          throw new Error('Document not associated with any project');
        }

        const projectIds = projectRelations.map(rel => rel.projectId);

        const chunksForDb: Chunk[] = (data?.chunks || []).map((chunk: any, index: number) => ({
          id: randomUUID(),
          projectId: projectIds,
          documentId: document.id,
          content: chunk.content,
          metadata: {
            source_file: document.fileName,
            page_number: chunk.metadata?.page_number ?? 0,
            chunk_index: index,
            user_description: document.user_description || undefined,
            keywords: document.keywords ? JSON.parse(document.keywords) : [],
          }
        }));

        // Add to vector store for each project (for now, use the first project)
        if (projectIds.length === 0) {
          throw new Error('No project IDs found for document');
        }
       await vectorService.addDocuments(projectIds[0]!, chunksForDb);

        await db.updateTable('jobs').set({ status: 'done' }).where('id', '=', jobId).execute();
        await db.updateTable('documents').set({ status: 'indexed' }).where('id', '=', document.id).execute();

        return reply.code(200).send({ message: 'Processing complete' });
      } catch (e: any) {
        server.log.error(`Error finalizing job ${jobId}: ${e.message}`);
        await db.updateTable('jobs').set({ status: 'failed' }).where('id', '=', jobId).execute();
        await db.updateTable('documents').set({ status: 'error' }).where('id', '=', document.id).execute();
        return reply.code(500).send({ error: 'Failed to finalize job' });
      }
    }
  );

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
      const results = await vectorService.search(projectId, query, '', topK);

      if (results.length === 0) {
        return reply.send({
          answer: "I couldn't find any relevant information in your documents to answer that question.",
          sources: [],
          query
        });
      }

      // Extract relevant context from search results
      const context = results
        .map((result: any) => result.chunk.content)
        .join('\n\n');

      // For now, return a simple response with context
      // TODO: Integrate with an LLM for better responses
      const response = {
        answer: `Based on your documents, here's what I found:\n\n${context}`,
        sources: results.map((result: any) => ({
          filename: result.chunk.source_file,
          chunkIndex: result.chunk.chunk_index,
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
      // Query documents that belong to this project using the join table
      const documents = await db
        .selectFrom('documents')
        .innerJoin('project_documents', 'documents.id', 'project_documents.documentId')
        .selectAll('documents')
        .where('project_documents.projectId', '=', projectId)
        .execute();

      const formattedDocuments = documents.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        status: doc.status,
        createdAt: doc.createdAt,
        userDescription: doc.user_description,
        keywords: doc.keywords ? JSON.parse(doc.keywords) : [],
      }));

      return reply.send({ documents: formattedDocuments });

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
    Params: { projectId: string; documentId: string };
  }>('/projects/:projectId/documents/:documentId', async (request, reply) => {
    const { projectId, documentId } = request.params;

    try {
      // Find the document and verify it belongs to this project
      const document = await db
        .selectFrom('documents')
        .innerJoin('project_documents', 'documents.id', 'project_documents.documentId')
        .selectAll('documents')
        .where('documents.id', '=', documentId)
        .where('project_documents.projectId', '=', projectId)
        .executeTakeFirst();

      if (!document) {
        return reply.code(404).send({ 
          error: 'Document not found or does not belong to this project' 
        });
      }

      // Delete from vector database
      await vectorService.deleteDocument(projectId, document.fileName);

      // Delete the physical file
      try {
        await fs.unlink(document.filePath);
      } catch (fileError) {
        console.log(`Could not delete physical file: ${document.filePath}`, fileError);
      }

      // Delete from project_documents join table
      await db
        .deleteFrom('project_documents')
        .where('documentId', '=', documentId)
        .where('projectId', '=', projectId)
        .execute();

      // Check if document is associated with other projects
      const remainingProjects = await db
        .selectFrom('project_documents')
        .select(['projectId'])
        .where('documentId', '=', documentId)
        .execute();

      // If no other projects reference this document, delete the document itself
      if (remainingProjects.length === 0) {
        await db
          .deleteFrom('documents')
          .where('id', '=', documentId)
          .execute();

        // Also clean up any related jobs
        await db
          .deleteFrom('jobs')
          .where('relatedId', '=', documentId)
          .execute();
      }

      return reply.send({ 
        message: 'Document deleted successfully',
        documentId 
      });

    } catch (error: any) {
      server.log.error(error, 'Failed to delete document');
      return reply.code(500).send({ 
        error: 'Failed to delete document',
        details: error.message 
      });
    }
  });

  /**
   * Add an existing document to another project
   */
  server.post<{
    Params: { projectId: string; documentId: string };
  }>('/projects/:projectId/documents/:documentId/link', async (request, reply) => {
    const { projectId, documentId } = request.params;

    try {
      // Check if document exists
      const document = await db
        .selectFrom('documents')
        .select(['id'])
        .where('id', '=', documentId)
        .executeTakeFirst();

      if (!document) {
        return reply.code(404).send({ 
          error: 'Document not found' 
        });
      }

      // Check if relationship already exists
      const existingLink = await db
        .selectFrom('project_documents')
        .select(['projectId'])
        .where('projectId', '=', projectId)
        .where('documentId', '=', documentId)
        .executeTakeFirst();

      if (existingLink) {
        return reply.code(409).send({ 
          error: 'Document is already linked to this project' 
        });
      }

      // Create the link
      await db
        .insertInto('project_documents')
        .values({
          projectId,
          documentId,
        })
        .execute();

      return reply.send({ 
        message: 'Document linked to project successfully',
        projectId,
        documentId
      });

    } catch (error: any) {
      server.log.error(error, 'Failed to link document to project');
      return reply.code(500).send({ 
        error: 'Failed to link document to project',
        details: error.message 
      });
    }
  });
}
