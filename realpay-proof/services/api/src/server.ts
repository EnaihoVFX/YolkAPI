import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config as loadEnv } from 'dotenv';

loadEnv();

async function start() {
  const server = Fastify({ logger: true });

  await server.register(cors, { origin: true });

  server.get('/health', async () => ({ status: 'ok' }));
  server.get('/', async () => ({ name: 'realpay-api', version: '0.1.0' }));

  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? '0.0.0.0';

  try {
    await server.listen({ port, host });
    server.log.info(`listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

void start();


