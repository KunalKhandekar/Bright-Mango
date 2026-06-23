import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../common/utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<typeof mongoose> {
  mongoose.connection.on('connected', () => logger.info('[mongo] connected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, '[mongo] connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('[mongo] disconnected'));

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
  });

  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}
