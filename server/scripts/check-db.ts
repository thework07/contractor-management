import { createLogger } from '../src/common/logger/logger';
import { connectMongo, disconnectMongo, pingMongo } from '../src/database';

const log = createLogger('db:check');

const main = async (): Promise<void> => {
  await connectMongo();
  const latency = await pingMongo();
  log.info(`MongoDB connectivity OK (ping ${latency}ms)`);
  await disconnectMongo();
};

main().catch((error: unknown) => {
  log.error('MongoDB connectivity check failed', { error });
  process.exit(1);
});
