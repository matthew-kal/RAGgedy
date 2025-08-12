import fastify from 'fastify';
import cors from '@fastify/cors'; // Import the cors package
import { setupDatabase } from './db/migrations';
import { projectRoutes } from './routes/projects';
import { documentRoutes } from './routes/documents';

const server = fastify({ logger: true });

server.register(cors, {
  origin: '*',
});

server.get('/ping', async (request, reply) => {
  return { pong: 'it works!' };
});

server.register(projectRoutes);
server.register(documentRoutes);

const start = async () => {
  try {
    await setupDatabase();
    await server.listen({ port: 3001 });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();