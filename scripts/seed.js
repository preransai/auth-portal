const config = require('../src/config');
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const { seedDemoData, DEMO_ACCOUNTS } = require('../src/services/seed');

async function main() {
  if (!config.mongoUri) {
    console.log('MONGODB_URI is not set. Nothing to seed.');
    console.log('(`npm run dev` without MONGODB_URI uses an in-memory database and seeds it automatically.)');
    return;
  }

  await connectDatabase(config.mongoUri);
  const created = await seedDemoData();

  if (created.length === 0) {
    console.log('Demo accounts already exist, nothing to do.');
  } else {
    console.log(`Created ${created.length} account(s): ${created.join(', ')}`);
    console.log(`Password for all demo accounts: ${DEMO_ACCOUNTS.password}`);
  }
}

main()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
