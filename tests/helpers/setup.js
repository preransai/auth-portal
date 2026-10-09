const os = require('os');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { createApp } = require('../../src/app');
const { connectDatabase } = require('../../src/config/db');
const { clearOutbox } = require('../../src/services/mail');

// Call at the top of a test file. Connects to a fresh database for this file,
// wipes it between tests and disconnects at the end so Jest can exit cleanly.
function useTestApp() {
  const context = {};

  beforeAll(async () => {
    const dbName = `test_${crypto.randomBytes(4).toString('hex')}`;
    // The MongoDB driver loads `os` with a dynamic import(), which Jest's
    // CommonJS sandbox refuses to run. Passing the module in avoids it.
    await connectDatabase(process.env.TEST_MONGO_URI, { dbName, runtimeAdapters: { os } });
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    context.app = createApp({ mongoClient: mongoose.connection.getClient() });
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
    clearOutbox();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  return context;
}

module.exports = { useTestApp };
