import { FastifyInstance } from 'fastify';
import { db } from '../db';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Project } from 'shared-types';

export async function projectRoutes(server: FastifyInstance) {
    /**
     * Route to CREATE a new project.
     * ACCEPTS the full project object from the client, as requested.
     * The server will override the client's 'id' with a secure, unique one.
     */
    server.post<{ Body: Project }>('/projects', async (request, reply) => {
        const projectFromClient = request.body;

        // 1. Validate the required 'name' field from the client's object
        if (!projectFromClient.name || typeof projectFromClient.name !== 'string' || projectFromClient.name.trim() === '') {
            return reply.code(400).send({ error: 'Project name is required and cannot be empty.' });
        }

        // 2. Generate a new, secure ID on the server, ignoring any ID from the client
        const newId = randomUUID();
        const projectPath = path.resolve(process.cwd(), 'data', newId);

        // 3. Prepare the final object for the database using client data
        const projectForDb = {
            id: newId, // Use the new server-generated ID
            name: projectFromClient.name,
            description: projectFromClient.description || '',
            createdAt: projectFromClient.createdAt,
            lastAccessed: projectFromClient.lastAccessed,
            documentCount: projectFromClient.documentCount || 0,
        };

        try {
            await fs.mkdir(projectPath, { recursive: true });

            const newProject = await db
                .insertInto('projects')
                .values(projectForDb)
                .returningAll()
                .executeTakeFirstOrThrow();
            
            // 4. Return the complete project object with the correct ID
            return reply.code(201).send(newProject);

        } catch (error: any) {
            server.log.error(error, 'Failed to create project');
            await fs.rm(projectPath, { recursive: true, force: true }).catch(() => {});
            return reply.code(500).send({ error: 'An unexpected error occurred on the server.' });
        }
    });

    /**
     * Route to GET a list of all existing projects.
     */
    server.get('/projects', async (request, reply) => {
        try {
            const projects = await db.selectFrom('projects').selectAll().orderBy('createdAt', 'desc').execute();
            return reply.code(200).send(projects);
        } catch (error) {
            server.log.error(error, 'Failed to retrieve projects');
            return reply.code(500).send({ error: 'Failed to retrieve projects from the database.' });
        }
    });
}