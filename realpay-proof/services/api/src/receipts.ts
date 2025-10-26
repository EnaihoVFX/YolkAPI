import type { FastifyInstance } from 'fastify';

export default async function receipts(app: FastifyInstance) {
  app.get('/', async () => ({ ok: true, service: 'receipts' }));
}


