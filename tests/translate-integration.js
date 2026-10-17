// Run with: node tests/translate-integration.js (no database or network connections)
'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const coffee = require('coffee-script');
const { EventEmitter } = require('events');
const { migrate } = require('../tool/migrate-blacklist-userid-index');
function load(file, scope) {
  const module = { exports: {} };
  const context = Object.assign(scope.global || {}, { module, exports: module.exports, console, Promise, Number, Map, setTimeout, clearTimeout }, scope);
  context.global = context;
  vm.runInNewContext(coffee.compile(fs.readFileSync(file, 'utf8'), { bare: true }), context, { filename: file });
  return module.exports;
}
(async () => {
  const collections = {}, indexes = [];
  let releaseFavorites;
  const favoriteReady = new Promise(resolve => { releaseFavorites = resolve; });
  const database = { collection(name) {
    return collections[name] ||= { createIndex(key, options) {
      indexes.push({ name, key, options });
      return name === 'roomfavorites' ? favoriteReady : Promise.resolve('index');
    } };
  } };
  const global = {};
  const db = load('server/db.coffee', { global, Config: { mongo: {} }, require: () => ({ MongoClient: class {
    connect(callback) { callback(null); }
    db() { return database; }
  } }) });
  let loaded = 0;
  db.dbinit(() => { loaded++; });
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(loaded, 0, 'initialization must wait for favorite indexes');
  releaseFavorites();
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(loaded, 1);
  assert.strictEqual(Object.keys(global.M).length, 11);
  assert(indexes.some(x => x.name === 'roomfavorites' && x.options?.unique));
  assert(indexes.some(x => x.name === 'blacklist' && x.key === 'userid' && !x.options?.unique));
  let current = {name: 'userid_1', key: {userid: 1}, unique: true};
  let drops = 0, creates = 0;
  const blacklist = {
    listIndexes: () => ({toArray: async () => current ? [current] : []}),
    dropIndex: async name => { assert.strictEqual(name, 'userid_1'); drops++; current = null; },
    createIndex: async (key, options) => { creates++; current = {key, ...options}; },
  };
  await migrate(blacklist);
  assert.strictEqual(drops, 0, 'dry run cannot mutate indexes');
  await migrate(blacklist, true);
  await migrate(blacklist, true);
  assert.strictEqual(drops, 1);
  assert.strictEqual(creates, 1, 'migration is idempotent');
  const me = {userid: 'me', realid: 'me', mode: 'player'};
  const gm = {userid: 'gm', realid: 'gm-real', mode: 'gm'};
  let pipeline, writes = 0;
  const M = {
    rooms: {findOne: (q, cb) => cb(null, {id: 1, made: Date.now(), mode: 'waiting', players: [me, gm]}),
      updateOne() { writes++; }},
    userrawlogs: {aggregate(stages) {
      pipeline = stages;
      return {stream() {
        const stream = new EventEmitter();
        stream.destroy = () => {};
        process.nextTick(() => {
          stream.emit('data', {room: {id: 18, blind: true, password: 'secret', owner: {userid:'gm-real'}, players: [ {...me, realname:'Account name'} ]}});
          stream.emit('end');
        });
        return stream;
      }};
    }},
  };
  const rooms = load('server/rpc/game/rooms.coffee', { M, Config: {rooms:{fresh:1}}, require(path) {
    if (path.includes('i18n')) return { getWithDefaultNS: () => ({t: key => key}) };
    if (path.includes('userlogs')) return {DataTypes: {game:1}};
    if (path === 'crypto') return require('crypto');
    return {};
  }});
  const req = {use() {}, session:{userId:'me'}};
  const result = await new Promise(resolve => rooms.actions(req, resolve, {}).getMyRooms(2, 20));
  assert.strictEqual(pipeline[0].$match.gameid.$lt, 20);
  assert.strictEqual(pipeline.find(x => '$skip' in x).$skip, 0);
  assert.strictEqual(result[0].room.password, undefined);
  assert.strictEqual(result[0].room.owner, undefined);
  assert.strictEqual(result[0].room.players[0].realid, undefined);
  assert.strictEqual(result[0].room.players[0].realname, undefined);
  assert.strictEqual(result[0].room.players[0].me, true);
  await new Promise(resolve => rooms.actions(req, resolve, {}).getMyRooms(2));
  assert.strictEqual(pipeline.find(x => '$skip' in x).$skip, 20, 'direct page links retain pagination');
  let error;
  rooms.actions(req, value => {error = value;}, {}).helper(1, 'gm');
  assert.strictEqual(error, 'error.helperTargetNotPlayer');
  assert.strictEqual(writes, 0, 'invalid helper must not write room state');
  console.log('Translate integration passed: 11 collections, favorite indexes, blacklist migration, cursor pagination, anonymity and helper invariants.');
})().catch(err => { console.error(err); process.exitCode = 1; });
