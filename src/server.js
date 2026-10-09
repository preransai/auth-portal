const mongoose = require('mongoose');
const config = require('./config');
const { connectDatabase, disconnectDatabase, startMemoryServer } = require('./config/db');
const { createApp } = require('./app');
const { seedDemoData, DEMO_ACCOUNTS } = require('./services/seed');

async function resolveMongoUri() {
  if (config.mongoUri) return { uri: config.mongoUri, inMemory: false };
  console.log('MONGODB_URI is not set, starting an in-memory MongoDB for development...');
  return { uri: await startMemoryServer(), inMemory: true };
}

function printDemoNote() {
  console.log('');
  console.log('  Running with an in-memory database. Everything is wiped when the server stops.');
  console.log('  Demo accounts (password for all of them: %s):', DEMO_ACCOUNTS.password);
  for (const account of DEMO_ACCOUNTS.users) {
    console.log('    %s  %s', account.email.padEnd(24), account.note);
  }
  console.log('  Emails are not sent anywhere; read them at %s/dev/mailbox', config.appUrl);
  console.log('');
}

async function start() {
  const { uri, inMemory } = await resolveMongoUri();
  await connectDatabase(uri);

  if (inMemory) {
    await seedDemoData();
    printDemoNote();
  }

  const app = createApp({ mongoClient: mongoose.connection.getClient() });
  const server = app.listen(config.port, () => {
    console.log(`${config.appName} listening on ${config.appUrl} (${config.env})`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(async (err) => {
  console.error('Failed to start:', err.message);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
