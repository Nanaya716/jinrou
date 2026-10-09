// Run with: node tests/qqbot.js (all gateway and HTTPS traffic is simulated)
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const EventEmitter = require('events');
const coffee = require('coffee-script');
const requests = [];
const sockets = [];
const scheduled = [];
const generated = [];
let roomQueries = 0;
let failGeneration = false;
const config = {enable: true, appID: 'test', appSecret: 'test', groupOpenIDs: [' target-a ', 'target-b']};
class Socket extends EventEmitter {
  constructor(url) {super(); this.url = url; this.readyState = 1; sockets.push(this);}
  send() {}
}
Socket.OPEN = 1;
const https = {
  request(options, callback) {
    const req = new EventEmitter();
    let data = '';
    req.write = chunk => {data += chunk;};
    req.end = () => {
      const body = data ? JSON.parse(data) : undefined;
      requests.push({options, body});
      const response = options.path === '/app/getAppAccessToken'
        ? {access_token: 'test-token', expires_in: 7200}
        : options.path === '/gateway' ? {url: 'wss://test.invalid'} : {id: 'sent'};
      setImmediate(() => {
        const res = new EventEmitter();
        res.statusCode = 200;
        callback(res);
        res.emit('data', Buffer.from(JSON.stringify(response)));
        res.emit('end');
      });
    };
    return req;
  },
};
const moduleObject = {exports: {}};
vm.runInNewContext(coffee.compile(fs.readFileSync('server/qqbot.coffee', 'utf8'), {bare: true}), {
  module: moduleObject, exports: moduleObject.exports,
  require(name) {
    if (name === 'https') return https;
    if (name === 'ws') return Socket;
    if (name === './libs/qqbot-daily-casting.coffee') return {start: (...args) => scheduled.push(args)};
    if (name === './libs/random-casting.coffee') return {buildMessage: number => {
      if (failGeneration) throw new Error('Generation failed');
      generated.push(number);
      return `配役 ${number === undefined ? '随机12–30' : number}`;
    }};
    throw new Error(`Unexpected dependency: ${name}`);
  },
  Config: {qqbot: config, rooms: {fresh: 72}},
  M: {rooms: {find: () => {
    roomQueries++;
    return {sort: () => ({limit: () => ({toArray: callback => callback(null, [])})})};
  }}},
  console: {log() {}, error() {}}, process: {platform: process.platform},
  Buffer, Promise, Map, Date, setTimeout, clearTimeout, setInterval, clearInterval,
});
const bot = moduleObject.exports;
const flush = async () => {for (let i = 0; i < 10; i++) await new Promise(setImmediate);};
const messages = () => requests.filter(r => r.options.path.includes('/messages'));
const receive = (content, id, group = 'source') => sockets[0].emit('message', JSON.stringify({
  op: 0, t: 'GROUP_AT_MESSAGE_CREATE', d: {group_openid: group, id, content},
}));
(async () => {
  bot.start();
  await flush();
  assert.strictEqual(sockets.length, 1);
  assert.strictEqual(scheduled.length, 1);
  assert.deepStrictEqual(Array.from(scheduled[0][1]()), ['target-a', 'target-b']);
  receive(' /使绊子 ', 'random');
  await flush();
  assert.strictEqual(generated.length, 1);
  assert.strictEqual(generated[0], undefined);
  let message = messages().at(-1);
  assert.strictEqual(message.options.path, '/v2/groups/source/messages');
  assert.strictEqual(message.body.msg_type, 0);
  assert.strictEqual(message.body.msg_id, 'random');
  assert.strictEqual(message.body.msg_seq, 1);
  assert(!message.body.markdown && !message.body.keyboard);
  receive('/使绊子', 'random');
  await flush();
  assert.strictEqual(messages().length, 1);
  receive('/使绊子 18', 'specified');
  receive('使绊子 12', 'bare');
  receive('／使绊子 30', 'fullwidth');
  await flush();
  assert.deepStrictEqual(generated, [undefined, 18, 12, 30]);
  for (const text of ['/使绊子 11', '/使绊子 31', '/使绊子 12.5', '/使绊子 abc', '/使绊子 18 extra']) {
    receive(text, `invalid-${text}`);
  }
  await flush();
  assert.strictEqual(generated.length, 4);
  assert(messages().slice(-5).every(r => r.body.content.startsWith('用法：')));
  failGeneration = true;
  receive('/使绊子', 'failure');
  await flush();
  assert.strictEqual(messages().at(-1).body.content, '生成名单失败，请稍后再试。');
  failGeneration = false;
  // The replaced command no longer triggers random casting.
  receive('/出名单', 'old-command');
  receive('房间列表', 'rooms');
  await flush();
  assert.strictEqual(roomQueries, 2);
  message = messages().at(-1);
  assert.strictEqual(message.body.msg_type, 2);
  assert(message.body.keyboard && message.body.markdown);
  assert.strictEqual(message.body.msg_id, 'rooms');
  // The scheduled send is proactive text, independent of the command's source group.
  await scheduled[0][2]('target-a', '每日名单');
  message = messages().at(-1);
  assert.strictEqual(message.options.path, '/v2/groups/target-a/messages');
  assert.strictEqual(message.body.content, '每日名单');
  assert.strictEqual(message.body.msg_type, 0);
  assert(!message.body.msg_id);
  // Existing game-start broadcast still sends Markdown and the supplied keyboard.
  const keyboard = bot.gameRoomKeyboard(123);
  await bot.sendGroupMessage('游戏开始', keyboard);
  assert.deepStrictEqual(messages().slice(-2).map(r => r.options.path), [
    '/v2/groups/target-a/messages', '/v2/groups/target-b/messages',
  ]);
  assert(messages().slice(-2).every(r => r.body.msg_type === 2 && JSON.stringify(r.body.keyboard) === JSON.stringify(keyboard)));
  assert.strictEqual(requests.filter(r => r.options.path === '/app/getAppAccessToken').length, 1);
  // Legacy single-group configuration remains supported.
  config.groupOpenIDs = [];
  config.groupOpenID = 'legacy';
  assert.deepStrictEqual(Array.from(scheduled[0][1]()), ['legacy']);
  console.log('QQ bot passed: command routing, replies, duplicate events, daily send and existing broadcasts.');
})().catch(error => {console.error(error); process.exitCode = 1;});
