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
  Math.random = () => 0;
  // Test random population separately; a constant RNG cannot exercise role selection.
  const originalGenerate = require('../server/libs/yaminabe.coffee').generate;
  const yaminabe = require('../server/libs/yaminabe.coffee');
  const requested = [];
  yaminabe.generate = options => {
    requested.push(options.playersnumber);
    const joblist = options.joblist;
    joblist.Human = options.playersnumber;
    return {joblist};
  };
  try {
    assert.strictEqual(casting.generate().number, 12);
    Math.random = () => 1 - Number.EPSILON;
    assert.strictEqual(casting.generate().number, 30);
    assert.deepStrictEqual(requested, [12, 30]);
  } finally {
    yaminabe.generate = originalGenerate;
  }
} finally {
  Math.random = previousRandom;
}
console.log(`Random casting passed: ${checked} samples, population bounds and invalid inputs.`);
