import type { FastifyInstance } from 'fastify';

export default async function tags(app: FastifyInstance) {
  app.get('/', async () => ({ ok: true, service: 'tags' }));
}


