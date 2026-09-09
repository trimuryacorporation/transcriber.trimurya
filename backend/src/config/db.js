import mongoose from 'mongoose';
import dns from 'node:dns';

export async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGODB_URI or MONGO_URI is required');
  if (mongoUri.startsWith('mongodb+srv://')) {
    dns.setServers((process.env.DNS_SERVERS || '1.1.1.1,8.8.8.8').split(',').map((server) => server.trim()));
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}
