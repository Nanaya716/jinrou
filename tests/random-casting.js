// Run with: node tests/random-casting.js
const assert = require('assert');
require('coffee-script/register');
const Shared = require('../client/code/shared/game.coffee');
const casting = require('../server/libs/random-casting.coffee');
const roleNames = Shared.jobs.concat(Shared.hiddenJobs);
let checked = 0;
for (let number = 12; number <= 30; number++) {
  for (let sample = 0; sample < 100; sample++) {
    const result = casting.generate(number);
    assert.strictEqual(result.number, number);
    let total = 0;
    for (const [job, count] of Object.entries(result.joblist)) {
      assert(Number.isInteger(count) && count >= 0, `${job}: ${count}`);
      if (count > 0) assert(roleNames.includes(job), `Unresolved role: ${job}`);
      total += count;
    }
    assert.strictEqual(total, number);
    assert(result.joblist.Human >= Math.ceil(number * 0.1));
    assert(result.joblist.Human <= Math.floor(number * 0.4));
    assert(['Diviner', 'SuperDiviner', 'MumouDiviner'].some(job => result.joblist[job] > 0));
    for (const excluded of ['Thief', 'MinionSelector', 'QuantumPlayer',
      'SpaceWerewolfCrew', 'SpaceWerewolfImposter', 'BloodyMary', 'Spy2',
      'SpiritPossessed', 'MadWolf', 'DarkClown']) {
      assert.strictEqual(result.joblist[excluded] || 0, 0, excluded);
    }
    assert(Shared.categories.Werewolf.reduce((sum, job) => sum + result.joblist[job], 0) > 0);
    if (result.joblist.Couple > 0) assert(result.joblist.Couple >= 2);
    if (result.joblist.Twin > 0) assert(result.joblist.Twin >= 2);
    if (number < 13) assert.strictEqual(result.joblist.Lorelei, 0);
    checked++;
  }
}
for (const value of [11, 31, 12.5, '18', NaN, Infinity]) {
  assert.throws(() => casting.generate(value), /人数/);
}
const previousRandom = Math.random;
try {
  // Force both Human quota bounds and all three guaranteed diviners through the real algorithm.
  const diviners = ['Diviner', 'SuperDiviner', 'MumouDiviner'];
  for (let number = 12; number <= 30; number++) {
    for (const upper of [false, true]) {
      for (let index = 0; index < diviners.length; index++) {
        const draws = [upper ? 1 - Number.EPSILON : 0, (index + 0.5) / diviners.length];
        Math.random = () => draws.length ? draws.shift() : previousRandom();
        const result = casting.generate(number);
        assert.strictEqual(result.joblist.Human, upper ? Math.floor(number * 0.4) : Math.ceil(number * 0.1));
        assert(result.joblist[diviners[index]] >= 1);
        checked++;
      }
    }
  }
  Math.random = () => 0;
  // Test random population separately; a constant RNG cannot exercise role selection.
  const originalGenerate = require('../server/libs/yaminabe.coffee').generate;
  const yaminabe = require('../server/libs/yaminabe.coffee');
  const requested = [];
  yaminabe.generate = options => {
    requested.push(options.playersnumber);
    const joblist = options.joblist;
    // Leave the reserved villagers and diviner intact; fill only remaining places.
    assert.strictEqual(options.frees, options.playersnumber - joblist.Human - 1);
    assert.deepStrictEqual(options.fixedJobs, ['Human']);
    joblist.Werewolf = options.frees;
    return {joblist};
  };
  try {
    const lower = casting.generate();
    assert.strictEqual(lower.number, 12);
    assert.strictEqual(lower.joblist.Human, 2);
    assert.strictEqual(lower.joblist.Diviner, 1);
    Math.random = () => 1 - Number.EPSILON;
    const upper = casting.generate();
    assert.strictEqual(upper.number, 30);
    assert.strictEqual(upper.joblist.Human, 12);
    assert.strictEqual(upper.joblist.MumouDiviner, 1);
    Math.random = () => 0.5;
    const middle = casting.generate(18);
    assert.strictEqual(middle.joblist.Human, 5);
    assert.strictEqual(middle.joblist.SuperDiviner, 1);
    assert.deepStrictEqual(requested, [12, 30, 18]);
  } finally {
    yaminabe.generate = originalGenerate;
  }
} finally {
  Math.random = previousRandom;
}
console.log(`Random casting passed: ${checked} samples, Human quotas, guaranteed diviners, population bounds and invalid inputs.`);
