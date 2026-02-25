import type { App } from '../index.js';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { isAIConfigured } from './reflection-chat.js';

export function registerHealthRoutes(app: App) {
  // GET /api/health - Health check endpoint
  app.fastify.get('/api/health', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    app.logger.info('Health check requested');

    return {
      status: 'ok',
      features: {
        aiChat: isAIConfigured,
        voiceTranscription: isAIConfigured,
      },
    };
  });
}
