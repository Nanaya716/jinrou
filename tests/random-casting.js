// Run with: node tests/random-casting.js
const assert = require('assert');
require('coffee-script/register');
const Shared = require('../client/code/shared/game.coffee');
const casting = require('../server/libs/random-casting.coffee');
const roleNames = Shared.jobs.concat(Shared.hiddenJobs);
let checked = 0;
const nonHumanCount = counts => roleNames.filter(job => !Shared.teams.Human.includes(job))
  .reduce((sum, job) => sum + counts[job], 0);
const thirdPartyKinds = counts => {
  const kinds = new Set();
  for (const job of roleNames) {
    if (!counts[job] || Shared.teams.Human.includes(job)) continue;
    const teams = Object.entries(Shared.teams).filter(([team, jobs]) =>
      !['Human', 'Werewolf'].includes(team) && jobs.includes(job));
    for (const [team] of teams) kinds.add(team === 'Others' ? job : team);
    if (!teams.length && !Shared.teams.Werewolf.includes(job)) kinds.add(job);
  }
  return kinds.size;
};
for (let number = 6; number <= 40; number++) {
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
    assert(nonHumanCount(result.joblist) < (number - 1) / 2);
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
for (const value of [0, 5, 41, 9.5, '9', NaN, Infinity]) {
  assert.throws(() => casting.generate(value), /人数/);
}
const previousRandom = Math.random;
try {
  // Force both Human quota bounds through the real high-safety algorithm.
  for (let number = 6; number <= 40; number++) {
    for (const upper of [false, true]) {
      const draws = [upper ? 1 - Number.EPSILON : 0];
      Math.random = () => draws.length ? draws.shift() : previousRandom();
      const result = casting.generate(number);
      assert.strictEqual(result.joblist.Human, upper ? Math.floor(number * 0.4) : Math.ceil(number * 0.1));
      assert(['Diviner', 'SuperDiviner', 'MumouDiviner'].some(job => result.joblist[job] > 0));
      checked++;
    }
  }
  // Exercise the actual high-safety selection step at each weight boundary.
  // This six-player fixture has only one diviner slot, so any stacking is visible.
  const yaminabeForWeights = require('../server/libs/yaminabe.coffee');
  const jobs = Object.fromEntries(roleNames.map(job => [job, true]));
  for (const [roll, selected] of [[0, 'Diviner'], [0.75 - Number.EPSILON, 'Diviner'],
    [0.75, 'SuperDiviner'], [0.875 - Number.EPSILON, 'SuperDiviner'],
    [0.875, 'MumouDiviner'], [1 - Number.EPSILON, 'MumouDiviner']]) {
    Math.random = () => roll;
    const joblist = Object.fromEntries(roleNames.map(job => [job, 0]));
    for (const category of Object.keys(Shared.categories)) joblist[`category_${category}`] = 0;
    joblist.Human = 2;
    joblist.category_Human = 1;
    const result = yaminabeForWeights.generate({
      joblist, jobs, frees: 3, playersnumber: 6,
      query: {jobrule: '特殊规则.黑暗火锅', yaminabe_safety: 'high', yaminabe_hidejobs: '',
        chemical: '', ushi: '', losemode: ''},
      jobStrength: {}, humanDisplayJobs: ['Oracle', 'Fate', 'Sleepwalker', 'Dreamer'],
      fixedJobs: ['Human'], guaranteeDiviner: true,
    });
    assert.strictEqual(result.joblist[selected], 1);
    assert.strictEqual(result.joblist.Diviner + result.joblist.SuperDiviner + result.joblist.MumouDiviner, 1);
  }
  // Stratify the probability draw to verify the 70/30 split without a flaky frequency test.
  const ranges = [0, 0];
  for (let sample = 0; sample < 100; sample++) {
    const draws = [(sample + 0.5) / 100, 0.5];
    Math.random = () => draws.length ? draws.shift() : previousRandom();
    const result = casting.generate();
    assert.strictEqual(result.number, sample < 70 ? 15 : 25);
    ranges[result.number <= 18 ? 0 : 1]++;
    checked++;
  }
  assert.deepStrictEqual(ranges, [70, 30]);
  // Verify every possible population within each interval, including 12/18 and 19/30.
  for (const [probability, first, size] of [[0.7 - Number.EPSILON, 12, 7], [0.7, 19, 12]]) {
    for (let index = 0; index < size; index++) {
      const draws = [probability, (index + 0.5) / size];
      Math.random = () => draws.length ? draws.shift() : previousRandom();
      assert.strictEqual(casting.generate().number, first + index);
      checked++;
    }
  }
  // Force both probability branches without changing the branch on retries.
  for (let number = 6; number <= 40; number++) {
    for (const branch of [0.9 - Number.EPSILON, 0.9]) {
      for (let sample = 0; sample < 10; sample++) {
        const draws = [previousRandom(), branch]; // Human quota, then third-party rule.
        Math.random = () => draws.length ? draws.shift() : previousRandom();
        const result = casting.generate(number);
        assert(nonHumanCount(result.joblist) < (number - 1) / 2);
        if (branch < 0.9) assert(thirdPartyKinds(result.joblist) <= 1);
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
    // The diviner is an unassigned Human-category slot until the high-safety step.
    assert.strictEqual(options.frees, options.playersnumber - joblist.Human - 1);
    assert.deepStrictEqual(options.fixedJobs, ['Human']);
    assert.strictEqual(options.guaranteeDiviner, true);
    assert.strictEqual(joblist.category_Human, 1);
    assert.strictEqual(joblist.Diviner + joblist.SuperDiviner + joblist.MumouDiviner, 0);
    joblist.category_Human = 0;
    joblist.Diviner = 1;
    assert.strictEqual(options.minHumanTeam, options.playersnumber - Math.ceil((options.playersnumber - 1) / 2) + 1);
    joblist.Werewolf = 1;
    joblist.Guard = options.frees - 1;
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
    assert.strictEqual(upper.joblist.Diviner, 1);
    Math.random = () => 0.5;
    const middle = casting.generate(18);
    assert.strictEqual(middle.joblist.Human, 5);
    assert.strictEqual(middle.joblist.Diviner, 1);
    const specified = casting.generate(9);
    assert.strictEqual(specified.number, 9);
    assert.strictEqual(specified.joblist.Human, 2);
    assert.strictEqual(specified.joblist.Diviner, 1);
    assert.deepStrictEqual(requested, [12, 30, 18, 9]);
  } finally {
    yaminabe.generate = originalGenerate;
  }
  // A fixed first draw must retain 90/10 semantics even when a candidate is rejected.
  for (const [branch, expectedAttempts] of [[0.9 - Number.EPSILON, 2], [0.9, 1]]) {
    const draws = [0, branch, 0];
    Math.random = () => draws.length ? draws.shift() : 0;
    let attempts = 0;
    yaminabe.generate = options => {
      attempts++;
      const joblist = options.joblist;
      joblist.category_Human = 0;
      joblist.Diviner = 1;
      joblist.Werewolf = 1;
      joblist.Fox = 1;
      joblist.Devil = attempts === 1 ? 1 : 0;
      joblist.Guard = 12 - joblist.Human - 3 - joblist.Devil;
      if (attempts === 2) {
        assert(options.excludedJobs.includes('Devil'));
        assert(options.excludedJobs.includes('FoxMatchmaker')); // Fox + Friend.
        assert(options.excludedJobs.includes('Bat'));
        assert(options.excludedJobs.includes('Tanner')); // Distinct independent winners.
        assert(!options.excludedJobs.includes('Fox'));
        assert(!options.excludedJobs.includes('Immoral')); // Same Fox team is allowed.
      }
      return {joblist};
    };
    try {
      const result = casting.generate(12);
      assert.strictEqual(attempts, expectedAttempts);
      assert.strictEqual(thirdPartyKinds(result.joblist), branch < 0.9 ? 1 : 2);
    } finally {
      yaminabe.generate = originalGenerate;
    }
  }
} finally {
  Math.random = previousRandom;
}
console.log(`Random casting passed: ${checked} samples, Human quotas, guaranteed diviners, 70/30 population weights, strict non-Human minority, 90% single-third-party branch, interval bounds and invalid inputs.`);
