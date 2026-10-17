// Run against an isolated local MongoDB 8 process only; no remote URI is accepted.
'use strict';
require('coffee-script/register');
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const coffee = require('coffee-script');
const {MongoClient} = require('mongodb');
const {migrate} = require('../tool/migrate-blacklist-userid-index');
if (!process.env.JINRO_SMOKE_PORT) throw new Error('Set JINRO_SMOKE_PORT to an isolated local MongoDB 8 port.');
const port = Number(process.env.JINRO_SMOKE_PORT);
const databaseName = 'translate_integration_smoke_' + process.pid + '_' + Date.now();
assert(/^translate_integration_smoke_[0-9]+_[0-9]+$/.test(databaseName));
const smokeUser = 'smoke:@/';
const smokePassword = 'local:test/@only';
const uri = 'mongodb://127.0.0.1:' + port + '/' + databaseName;
const call = invoke => new Promise((resolve,reject) => invoke((err,result) => err ? reject(err) : resolve(result)));
(async () => {
  assert(Number.isInteger(port) && port > 1024 && port < 65536);
  const client = new MongoClient(uri, {serverSelectionTimeoutMS:5000});
  try {
    await client.connect();
    const db = client.db();
    const build = await db.admin().command({buildInfo:1});
    assert.strictEqual(build.version.split('.')[0], '8');
    await db.dropDatabase();
    await db.command({createUser:smokeUser,pwd:smokePassword,roles:[{role:'dbOwner',db:databaseName}]});
    global.Config = require('../config.default/app.coffee');
    Config.mongo = {host:'127.0.0.1',port,database:databaseName};
    await new Promise(resolve => require('../server/db.coffee').dbinit(resolve));
    await DB.client.close();
    Config.mongo.user = smokeUser;
    Config.mongo.pass = smokePassword;
    await new Promise((resolve,reject) => {
      const timer = setTimeout(() => reject(new Error('dbinit timeout')),15000);
      require('../server/db.coffee').dbinit(() => {clearTimeout(timer);resolve();});
    });
    assert.strictEqual(Object.keys(M).length,11);
    for(const name of Object.keys(M)) assert((await db.collection(name).indexes()).length >= 2, name);
    assert((await M.roomfavorites.indexes()).some(index => index.unique));
    await call(cb => M.users.insertOne({userid:'me',name:'Tester'},{w:1},cb));
    await assert.rejects(call(cb => M.users.insertOne({userid:'me'},{w:1},cb)), err => err.code === 11000);
    await call(cb => M.users.updateOne({userid:'me'},{$set:{name:'Updated'}},{w:1},cb));
    assert.strictEqual((await call(cb => M.users.find({userid:'me'}).project({name:1}).next(cb))).name,'Updated');
    assert.strictEqual((await call(cb => M.users.find({userid:'me'}).toArray(cb))).length,1);
    await call(cb => M.rooms.insertOne({id:101,mode:'end',name:'Smoke room',blind:true,owner:{userid:'owner'},players:[{userid:'anonymous',realid:'me',realname:'Account'}]},{w:1},cb));
    await call(cb => M.userrawlogs.insertMany([{userid:'me',type:1,subtype:'draw',job:'Human',gameid:101,timestamp:new Date()}],{w:1},cb));
    await call(cb => M.roomfavorites.updateOne({userid:'me',roomid:101},{$setOnInsert:{userid:'me',roomid:101,createdAt:new Date()}},{upsert:true,w:1},cb));
    const module = {exports:{}};
    vm.runInNewContext(coffee.compile(fs.readFileSync('server/rpc/game/rooms.coffee','utf8'),{bare:true}),{module,exports:module.exports,M,Config,console,Promise,Map,Number,setTimeout,clearTimeout,require(path){
      if(path.includes('i18n'))return {getWithDefaultNS:()=>({t:key=>key})};
      if(path.includes('userlogs'))return {DataTypes:{game:1}};
      if(path==='crypto')return require('crypto');
      return {};
    }});
    const req={use(){},session:{userId:'me'}};
    const myRooms = await new Promise(resolve => module.exports.actions(req,resolve,{}).getMyRooms(0));
    assert.strictEqual(myRooms.length,1);
    assert.strictEqual(myRooms[0].room.players[0].realname,undefined);
    const favorites = await new Promise(resolve => module.exports.actions(req,resolve,{}).getFavoriteRooms(0,{}));
    assert.strictEqual(favorites.summary.draw,1);
    assert.strictEqual(favorites.rooms[0].room.id,101);
    const repaired = require('child_process').spawnSync(process.execPath,['tool/repair10-rebuild-userrawlogs-index.js'],{env:{...process.env,JINRO_MONGO_URI:uri},encoding:'utf8',timeout:10000});
    assert.strictEqual(repaired.status,0,repaired.stderr);
    const prize = await call(cb => M.userlogs.findOneAndUpdate({userid:'me'},{$inc:{'drawcount.all':1}},{upsert:true,returnDocument:'after',includeResultMetadata:true,w:1},cb));
    assert.strictEqual(prize.value.drawcount.all,1);
    await db.collection('blacklist').dropIndex('userid_1');
    await db.collection('blacklist').createIndex({userid:1},{unique:true});
    assert((await migrate(db.collection('blacklist'))).includes('would replace'));
    assert((await db.collection('blacklist').indexes()).find(x=>x.name==='userid_1').unique);
    await migrate(db.collection('blacklist'),true);
    await migrate(db.collection('blacklist'),true);
    assert(!(await db.collection('blacklist').indexes()).find(x=>x.name==='userid_1').unique);
    await call(cb=>M.blacklist.insertMany([{id:'a',userid:['me']},{id:'b',userid:['me']}],{w:1},cb));
    await call(cb=>M.roomfavorites.deleteOne({userid:'me',roomid:101},{w:1},cb));
    assert.strictEqual(await M.roomfavorites.countDocuments({}),0);
    // Test the actual historical short-ID repair with native legacy-wrapped handles.
    const Module = require('module'), path = require('path');
    Config.language = {value:'ja',fallback:'ja'};
    const filename = path.resolve('server/rpc/game/mongodb8-smoke-harness.coffee');
    const harness = new Module(filename,module);
    harness.filename = filename;
    harness.paths = Module._nodeModulePaths(path.dirname(filename));
    harness._compile(coffee.compile(fs.readFileSync('server/rpc/game/game.coffee','utf8')+'\nmodule.exports.__smoke = {Game, ensureShortIds}\n'),filename);
    const {Game, ensureShortIds} = harness.exports.__smoke;
    for(const version of ['v1','v2']) {
      const game = new Game({publish:{channel(){},user(){}}});
      game.id = version === 'v1' ? 201 : 202;
      game.log_save_mode = version;
      const logs = [{mode:'day',shortId:'12'},{mode:'day'},{mode:'probability_table',shortId:'13'}];
      await M.games.insertOne({id:game.id,logs:version==='v1'?logs:[]});
      if(version==='v2') await M.gamelogs.insertMany(logs.map(log=>({...log,gameid:game.id})));
      await call(cb=>ensureShortIds(game,cb));
      const document = await M.games.findOne({id:game.id});
      assert.strictEqual(document.shortIdEnabled,true);
      const saved = version==='v1'?document.logs:await M.gamelogs.find({gameid:game.id}).sort({_id:1}).toArray();
      assert.strictEqual(saved[0].shortId,'12');
      assert.match(saved[1].shortId,/^[0-9]+$/);
      assert.strictEqual(saved[2].shortId,undefined);
      await call(cb=>ensureShortIds(game,cb));
      const again = version==='v1'?(await M.games.findOne({id:game.id})).logs:await M.gamelogs.find({gameid:game.id}).sort({_id:1}).toArray();
      assert.strictEqual(again[1].shortId,saved[1].shortId);
    }
    console.log(JSON.stringify({node:process.version,mongodb:require('mongodb/package.json').version,legacy:require('mongodb-legacy/package.json').version,server:build.version,checks:'dbinit 11 collections/indexes, auth/unauth and encoded credentials; callback CRUD/errors/cursors; room aggregate/favorites RPC; prize metadata/upsert; userid migration/dryrun/idempotency; repair10; v1/v2 historical short IDs'}));
  } finally {
    if(global.DB) await DB.client.close();
    await client.db(databaseName).command({dropUser:smokeUser}).catch(()=>{});
    await client.db(databaseName).dropDatabase().catch(()=>{});
    await client.close();
  }
// Importing the game also starts theme timers; exit only after the finally cleanup.
})().then(()=>process.exit(0),err=>{console.error(err);process.exit(1);});
