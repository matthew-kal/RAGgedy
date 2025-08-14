// This service manages all WebSocket connections and broadcasts messages.
import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';

class WebSocketService {
    private projectConnections: Map<string, Set<WebSocket>> = new Map();

    public setup(server: FastifyInstance) {
        server.get('/ws/project/:projectId', { websocket: true }, (socket, req) => {
            const { projectId } = req.params as { projectId: string };

            if (!this.projectConnections.has(projectId)) {
                this.projectConnections.set(projectId, new Set());
            }
            const connections = this.projectConnections.get(projectId)!;
            connections.add(socket);

            console.log(`Client connected to project: ${projectId}`);

            socket.on('close', () => {
                connections.delete(socket);
                console.log(`Client disconnected from project: ${projectId}`);
            });
        });
    }

    public broadcast(projectId: string, message: object) {
        const connections = this.projectConnections.get(projectId);
        if (!connections) return;

        const payload = JSON.stringify(message);
        for (const socket of connections) {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(payload);
            }
        }
    }
}

export const websocketService = new WebSocketService();
