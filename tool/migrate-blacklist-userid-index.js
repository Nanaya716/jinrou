#!/usr/bin/env node
'use strict';
// Required once when upgrading a database with the old unique userid_1 index.
// Set JINRO_MONGO_URI; the URI is never printed. Default is a read-only dry run.
const { MongoClient } = require('mongodb');
async function migrate(collection, apply = false) {
  let indexes;
  try { indexes = await collection.listIndexes().toArray(); }
  catch (err) { if (err.code !== 26) throw err; indexes = []; }
  const index = indexes.find(item => item.name === 'userid_1');
  if (index && (Object.keys(index.key).length !== 1 || index.key.userid !== 1)) {
    throw new Error('Unexpected userid_1 index definition; inspect it manually.');
  }
  if (index && !index.unique) return 'already migrated';
  if (!apply) return index ? 'would replace unique userid_1 with non-unique index' : 'would create non-unique userid_1';
  if (index) await collection.dropIndex('userid_1');
  await collection.createIndex({ userid: 1 }, { name: 'userid_1' });
  return 'migrated';
}
exports.migrate = migrate;
if (require.main === module) {
  (async () => {
    if (!process.env.JINRO_MONGO_URI) throw new Error('Set JINRO_MONGO_URI to the target database URI.');
    const client = new MongoClient(process.env.JINRO_MONGO_URI);
    try {
      await client.connect();
      console.log(await migrate(client.db().collection('blacklist'), process.argv.includes('--apply')));
    } finally { await client.close(); }
  })().catch(err => { console.error(err.message); process.exitCode = 1; });
}
