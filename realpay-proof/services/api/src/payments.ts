import type { FastifyInstance } from 'fastify';

export default async function payments(app: FastifyInstance) {
  app.get('/', async () => ({ ok: true, service: 'payments' }));
}


