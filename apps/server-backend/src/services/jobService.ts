import { db } from '../db/index.js';
import type { DocumentsTable } from '../db/schema.js';
import { spawn } from 'child_process';
import path from 'path';
import { randomUUID } from 'crypto';

class JobService {
  public async createIngestionJob(documentId: DocumentsTable['id']): Promise<string> {
    const jobId = randomUUID();
    await db
      .insertInto('jobs')
      .values({
        id: jobId,
        jobType: 'ingest',
        relatedId: documentId,
        status: 'queued',
        createdAt: new Date().toISOString(),
      })
      .execute();
    console.log(`Created ingestion job ${jobId} for document ${documentId}`);
    return jobId;
  }
}

export const jobService = new JobService();

