import { spawn } from 'child_process';
import { db } from '../db';
import { vectorService } from './vectorService';
import { websocketService } from './websocketService';
import type { Chunk } from 'shared-types';
import { randomUUID } from 'crypto';
import path from 'path';

class JobRunner {
  private isRunning = false;
  private pollingInterval = 5000; // 5 seconds

  public start() {
    if (this.isRunning) {
      console.log('Job Runner is already running.');
      return;
    }
    console.log('✅ Job Runner has started. Polling for queued jobs every 5 seconds...');
    this.isRunning = true;
    setInterval(() => this.checkAndProcessJob(), this.pollingInterval);
  }

  private async checkAndProcessJob() {
    const job = await db
      .selectFrom('jobs')
      .selectAll()
      .where('status', '=', 'queued')
      .orderBy('createdAt', 'asc')
      .limit(1)
      .executeTakeFirst();

    if (!job) {
      return; // No jobs to process
    }

    const { relatedId: documentId } = job;
    let projectId = ''; // We need to find the projectId to broadcast messages

    try {
      // Get document details and project relation
      const document = await db.selectFrom('documents').selectAll().where('id', '=', documentId).executeTakeFirst();
      if (!document) throw new Error(`Document ${documentId} not found for job ${job.id}`);

      const relation = await db.selectFrom('project_documents').select('projectId').where('documentId', '=', documentId).executeTakeFirst();
      if (!relation) throw new Error(`Document ${documentId} is not associated with any project.`);
      projectId = relation.projectId;

      console.log(`[JobRunner] Picked up job: ${job.id} for document ${documentId}`);

      // 1. Lock the job and notify frontend
      await db.updateTable('jobs').set({ status: 'processing' }).where('id', '=', job.id).execute();
      await db.updateTable('documents').set({ status: 'parsing' }).where('id', '=', documentId).execute();
      websocketService.broadcast(projectId, {
        eventType: 'statusUpdate',
        documentId,
        status: 'parsing',
      });

      // 2. Execute the Python worker
      await this.executePythonWorker(document, projectId);

      // 3. Finalize the job successfully
      await db.updateTable('jobs').set({ status: 'done' }).where('id', '=', job.id).execute();
      await db.updateTable('documents').set({ status: 'indexed' }).where('id', '=', documentId).execute();
      websocketService.broadcast(projectId, {
        eventType: 'complete',
        documentId,
        status: 'indexed',
      });
      console.log(`[JobRunner] Successfully completed job: ${job.id}`);

    } catch (error: any) {
      console.error(`[JobRunner] Failed to process job ${job.id}:`, error);
      await db.updateTable('jobs').set({ status: 'failed' }).where('id', '=', job.id).execute();
      await db.updateTable('documents').set({ status: 'error' }).where('id', '=', documentId).execute();
      if (projectId) {
        websocketService.broadcast(projectId, {
          eventType: 'error',
          documentId,
          status: 'error',
          error: error.message,
        });
      }
    }
  }

  private executePythonWorker(document: any, projectId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonExecutablePath = path.resolve(__dirname, '../../../../tools/app/dist/worker');
        const workerProcess = spawn(pythonExecutablePath, ['--document-path', document.filePath]);

        // Listener for each line of JSON from Python's stdout
        workerProcess.stdout.on('data', async (data) => {
            const lines = data.toString().split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.type === 'chunk') {
                         await db.updateTable('documents').set({ status: 'embedding' }).where('id', '=', document.id).execute();
                         websocketService.broadcast(projectId, {
                            eventType: 'statusUpdate',
                            documentId: document.id,
                            status: 'embedding'
                         });

                        const chunkForDb: Chunk = {
                            id: randomUUID(),
                            projectId: [projectId],
                            documentId: document.id,
                            content: parsed.content,
                            metadata: {
                                source_file: document.fileName,
                                page_number: parsed.page_number,
                                chunk_index: 0, // This needs to be incremented
                                user_description: document.user_description,
                                keywords: document.keywords ? JSON.parse(document.keywords) : []
                            }
                        };
                        await vectorService.addDocuments(projectId, [chunkForDb]);
                    } else if (parsed.type === 'image') {
                       // Logic for creating image captioning job
                    }
                } catch (e) {
                    console.error('[JobRunner] Error parsing worker output:', e);
                }
            }
        });

        workerProcess.stderr.on('data', (data) => {
          console.error(`[PythonWorker ERROR]: ${data.toString()}`);
        });

        workerProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Python worker exited with code ${code}`));
            }
        });

        workerProcess.on('error', (err) => {
            reject(err);
        });
    });
}
}

export const jobRunner = new JobRunner();
