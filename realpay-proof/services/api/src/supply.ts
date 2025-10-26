import type { FastifyInstance } from 'fastify';

export default async function supply(app: FastifyInstance) {
  app.get('/', async () => ({ ok: true, service: 'supply' }));
}


