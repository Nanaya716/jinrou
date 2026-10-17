// Run with: node tests/qqbot-daily-casting.js (no QQ or database connections)
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const coffee = require('coffee-script');
const records = new Map();
const schedules = [];
const errors = [];
let generationCount = 0;
const collection = {
  insertOne(doc, options, callback) {
    assert.strictEqual(options.w, 1);
    if (doc.groupOpenID === 'db-error') return callback(new Error('Database unavailable'));
    if (records.has(doc._id)) return callback(Object.assign(new Error('Duplicate'), {code: 11000}));
    records.set(doc._id, {...doc});
    callback(null);
  },
  updateOne(filter, update, options, callback) {
    assert.strictEqual(options.w, 1);
    Object.assign(records.get(filter._id), update.$set);
    callback(null);
  },
};
const moduleObject = {exports: {}};
vm.runInNewContext(coffee.compile(fs.readFileSync('server/libs/qqbot-daily-casting.coffee', 'utf8'), {bare: true}), {
  module: moduleObject, exports: moduleObject.exports,
  require(name) {
    if (name === 'cron') return {CronJob: function(...args) {schedules.push(args);}};
    if (name === './random-casting.coffee') return {buildMessage: () => `casting ${++generationCount}`};
    throw new Error(`Unexpected dependency: ${name}`);
  },
  DB: {collection: name => {assert.strictEqual(name, 'qqbot_daily_castings'); return collection;}},
  console: {error: (...args) => errors.push(args)}, Date, Set, Promise,
});
const daily = moduleObject.exports;
(async () => {
  daily.start({dailyCasting: false}, () => [], () => {});
  assert.strictEqual(schedules.length, 0);
  daily.start({}, () => [], () => {});
  daily.start({}, () => [], () => {});
  assert.strictEqual(schedules.length, 1);
  assert.strictEqual(schedules[0][0], '0 0 10 * * *');
  assert.strictEqual(schedules[0][3], true);
  assert.strictEqual(schedules[0][4], 'Asia/Shanghai');
  const sent = [];
  const send = (group, content) => {sent.push({group, content}); return Promise.resolve();};
  const now = new Date('2026-10-08T16:00:00Z'); // Beijing October 9
  await Promise.all([daily.run(['a', 'b', 'a'], send, now), daily.run(['a', 'b'], send, now)]);
  assert.strictEqual(sent.length, 2);
  assert.deepStrictEqual(sent.map(x => x.group).sort(), ['a', 'b']);
  // Daily sends preserve the same single-line body as command replies.
  assert(sent.every(x => /^casting [0-9]+$/.test(x.content)));
  assert.strictEqual(records.get('2026-10-09:a').status, 'sent');
  assert.strictEqual(records.get('2026-10-09:b').status, 'sent');
  await daily.run(['a', 'b'], send, now);
  assert.strictEqual(sent.length, 2);
  await daily.run(['a', 'b'], send, new Date('2026-10-09T16:00:00Z'));
  assert.strictEqual(sent.length, 4);
  assert.strictEqual(sent[2].content, sent[3].content);
  await daily.run(['bad', 'good', 'db-error'], (group, content) => {
    if (group === 'bad') throw new Error('QQ rejected');
    return send(group, content);
  }, now);
  assert.strictEqual(records.get('2026-10-09:bad').status, 'failed');
  assert.strictEqual(records.get('2026-10-09:good').status, 'sent');
  assert(!sent.some(x => x.group === 'db-error'));
  await daily.run(['bad'], send, now);
  assert(!sent.some(x => x.group === 'bad'));
  const beforeEmpty = generationCount;
  await daily.run([], send, now);
  assert.strictEqual(generationCount, beforeEmpty);
  assert(errors.length > 0);
  console.log('Daily casting passed: schedule, Beijing date, concurrent deduplication and isolated failures.');
})().catch(error => {console.error(error); process.exitCode = 1;});
