const { MongoMemoryServer } = require('mongodb-memory-server');

// One mongod for the whole run; every test file gets its own database on it.
module.exports = async () => {
  const mongod = await MongoMemoryServer.create();
  globalThis.__MONGOD__ = mongod;
  process.env.TEST_MONGO_URI = mongod.getUri();
};
