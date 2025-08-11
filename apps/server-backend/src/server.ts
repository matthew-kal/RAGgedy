import fastify from 'fastify';
import { setupDatabase } from './db/migrations';

// Create a Fastify server instance
// The logger is enabled for helpful debugging output in your terminal
const server = fastify({ logger: true });

// A simple "health check" route to confirm the server is running
server.get('/ping', async (request, reply) => {
  return { pong: 'it works!' };
});

const start = async () => {
  try {
    // 1. Ensure database tables are created before the server starts accepting requests
    await setupDatabase();

    // 2. Start the server on port 3001 (or any port you choose)
    await server.listen({ port: 3001 });

    // The frontend will eventually make requests to this address
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Run the start function to boot up the server
start();