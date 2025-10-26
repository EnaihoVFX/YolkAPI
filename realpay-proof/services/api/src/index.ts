import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import payments from './routes/payments';
import receipts from './routes/receipts';
import tags from './routes/tags';
import supply from './routes/supply';

async function main() {
  const app = Fastify({ logger: true });

  await app.register(fastifyCors, { origin: true });

  // Basic routes
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/', async () => ({ name: 'realpay-api', version: '0.1.0' }));

  await app.register(payments, { prefix: '/pay' });
  await app.register(receipts, { prefix: '/receipts' });
  await app.register(tags, { prefix: '/tags' });
  await app.register(supply, { prefix: '/supply' });

  const port = 4000;
  const host = '0.0.0.0';
  await app.listen({ port, host });
}

void main();


