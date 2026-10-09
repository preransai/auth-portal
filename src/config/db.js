const mongoose = require('mongoose');

// Any filter object that sneaks in with a `$` key gets wrapped in `$eq`, so a
// payload like { "$ne": null } is compared literally instead of executed.
// Our own operator queries opt out explicitly with mongoose.trusted().
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

let memoryServer = null;

async function startMemoryServer() {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  return memoryServer.getUri('auth-portal');
}

async function connectDatabase(uri, options = {}) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, ...options });
  return mongoose.connection;
}

async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDatabase, disconnectDatabase, startMemoryServer };
