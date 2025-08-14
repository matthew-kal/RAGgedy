import fastify from 'fastify';
import websocket from '@fastify/websocket';
import { websocketService } from './services/websocketService';

import cors from '@fastify/cors'; // Import the cors package
import { setupDatabase } from './db/migrations';
import { projectRoutes } from './routes/projects';
import { documentRoutes } from './routes/documents';
import { jobRunner } from './services/jobRunner';

const server = fastify({ logger: true });

server.register(websocket);
websocketService.setup(server);

server.register(cors, {
  origin: '*',
});

server.get('/ping', async (request, reply) => {
  return { pong: 'it works!' };
});

server.get('/healthcheck', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

server.register(projectRoutes);
server.register(documentRoutes);

const start = async () => {
  try {
    await setupDatabase();
    jobRunner.start();

    // Use port 0 to let the OS assign an available port on localhost
    await server.listen({ port: 0, host: '127.0.0.1' });

    // --- TYPE-SAFE PORT RETRIEVAL ---
    const address = server.server.address();
    // Type guard to ensure address is an AddressInfo object, not a string
    if (typeof address === 'string' || !address) {
      throw new Error('Server started on a pipe/socket, not a network port.');
    }
    const port = address.port;
    // --- END FIX ---

    console.log(`🚀 Server ready and listening on port ${port}`);

    // Check if this is a child process and send the "ready" signal
    if (process.send) {
      process.send({ type: 'serverReady', port: port });
    }

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();