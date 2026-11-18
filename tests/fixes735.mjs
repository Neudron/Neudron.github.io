/* fixes735.mjs: G2 difficulty behavior and Medium identity. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { boot } from './lib/page.mjs';

const tiers = ['bot', 'easy', 'medium', 'hard', 'vhard', 'ultrakill', 'finalbreath'];
const soulHP = [16, 12, 8, 7, 6, 4, 1];
const bossHP = [783, 783, 783, 783, 979, 1175, 1175];
const timingNames = [
  'HorizontalDarkSoulRelease','CondemnationFanBurst','ExplosiveCharges','SummonSuicideBomberDemons','BrimstoneLightning','HexCollapse',
  'PredictiveCharge','ComboSkullRain','DartBurstFans','SideHellbarrage','TwinCharge','BrimstoneWalls',
  'ShadowDemon_ReleaseExplodingShadowBlasts','HellblastBarrage','BrimstoneJewelBeam','ConvergingSkulls','EyeLockBeams','ArcingEyeStarbursts',
  'ComboEyeHex','BrimstoneRain','GravityOfRuin','FireblastVolley','SkullWave','DartWallRain','FlamePillars','GravityBoneRush',
  'ShadowDemon_ShadowGigablastsAndCharges','FireLaserSpin','DarkMagicBombWalls','GigablastCross','CalamitousRend','DarknessLightSlashes',
  'ComboLaserHell','JudgementCut','PortalLaserbeams','FireLaserSpinClassic','BombBulletHell','RapidTeleports','BecomeBerserk',
  'SummonShadowDemon','SummonBrothers','SummonSeekers','SummonSepulcher','PhaseTransition','DesperationPhase'
];

function make() {
  const { w, NEU, key, errs } = boot({ seed: 735 });
  assert.deepEqual(errs, []);
  return { w, NEU, key };
}

function warningsFor(NEU, tier, name) {
  NEU.diff.set(tier);
  NEU.scal.close();
  NEU.scal.open();
  NEU.scal.hold(true);
  assert.equal(NEU.scal.force(name), true, 'attack exists: ' + name);
  const found = [], seen = new Set();
  for (let i = 0; i < 1800 && NEU.scalAtk.attack() === name; i++) {
    NEU.scalAtk.tick(1 / 60);
    for (const o of NEU.scalAtk.debug.warns) if (!seen.has(o)) { seen.add(o); found.push({ at: o.at, life: o.life }); }
  }
  return found;
}

function parkedHitFrame(NEU, tier) {
  NEU.diff.set(tier); NEU.scal.close(); NEU.scal.open(); NEU.scal.force('GigablastCross');
  for (let i = 0; i < 21; i++) NEU.scalAtk.tick(1 / 60);
  const warn = NEU.scalAtk.debug.warns.find(o => o.len === 220 && o.w === 2);
  assert.ok(warn, tier + ' GigablastCross delayed-shot warning');
  NEU.scal.arm(warn.x, warn.y, NEU.scal.bx, NEU.scal.by);
  NEU.scal.setHp(NEU.scal.soulHP);
  const hp = NEU.scal.soulHP;
  let hit = null;
  for (let i = 0; i < 180 && hit === null; i++) {
    NEU.scal.simulate(1 / 60);
    if (NEU.scal.soulHP < hp) hit = NEU.scalAtk.frame();
  }
  assert.notEqual(hit, null, tier + ' parked soul meets delayed bullet');
  return { hit, end: warn.at + warn.life };
}

{
  const { w, NEU } = make();
  try {
    NEU.diff.set('medium');
    NEU.scal.open();
    assert.equal(NEU.scal.bossMax(), 783);
    assert.equal(NEU.scal.soulHP, 8);
    for (let i = 0; i < tiers.length; i++) {
      NEU.diff.set(tiers[i]); NEU.scal.open();
      assert.equal(NEU.scal.soulHP, soulHP[i], tiers[i] + ' soul HP');
      assert.equal(NEU.scal.bossMax(), bossHP[i], tiers[i] + ' boss HP');
    }
  } finally { w.close(); }
}

{
  const { w, NEU } = make();
  try {
    const medium = parkedHitFrame(NEU, 'medium');
    const easy = parkedHitFrame(NEU, 'easy');
    const bot = parkedHitFrame(NEU, 'bot');
    assert.ok(medium.hit < medium.end, 'record Medium parked-soul early hit');
    assert.equal(easy.end, medium.end, 'Easy warning length stays at Medium when scaling desynchronizes hazards');
    assert.equal(bot.end, medium.end, 'Bot warning length stays at Medium when scaling desynchronizes hazards');
  } finally { w.close(); }
}

{
  const { w, NEU } = make();
  try {
    const medium = {};
    for (const name of timingNames) {
      medium[name] = warningsFor(NEU, 'medium', name);
      for (const tier of ['hard', 'vhard', 'ultrakill', 'finalbreath'])
        assert.ok(warningsFor(NEU, tier, name).every(o => o.life >= 24), tier + ' ' + name + ' warning floor');
      if (!medium[name].length) continue;
      for (const tier of ['easy', 'bot']) {
        const lower = warningsFor(NEU, tier, name);
        assert.equal(lower[0].life, medium[name][0].life, tier + ' ' + name + ' warning stays Medium length');
      }
    }
  } finally { w.close(); }
}

{
  const { w, NEU } = make();
  try {
    const gapFor = tier => {
      NEU.diff.set(tier); NEU.scal.open(); NEU.scal.hold(true); NEU.scal.force('DartBurstFans');
      for (let i = 0; i < 2000 && NEU.scalAtk.attack(); i++) NEU.scalAtk.tick(1 / 60);
      let idle = 0;
      for (let i = 0; i < 300 && !NEU.scalAtk.attack(); i++) { NEU.scalAtk.tick(1 / 60); if (!NEU.scalAtk.attack()) idle++; }
      return idle;
    };
    assert.equal(gapFor('medium'), 52);
    assert.equal(gapFor('hard'), 44);
  } finally { w.close(); }
}

{
  const { w, NEU, key } = make();
  try {
    NEU.diff.set('finalbreath');
    NEU.save.give('mend'); NEU.save.equip('spell1', 'mend');
    NEU.scal.open(); NEU.scal.hold(true); NEU.scal.force('DartBurstFans');
    NEU.scal.setHp(0); NEU.scal.setTp(100);
    key('c'); key('ArrowDown'); key('z');
    assert.equal(NEU.scal.soulHP, 0, 'direct keyboard HEAL spell blocked at Final Breath');
    assert.match(NEU.scal.line, /no heals/);
    key('x'); key('c'); key('z');
    assert.equal(NEU.scal.soulHP, 0, 'direct keyboard base HEAL blocked at Final Breath');
  } finally { w.close(); }
  const { w: w2, NEU: N2, key: k2 } = make();
  try {
    N2.diff.set('bot'); N2.scal.open(); N2.scal.hold(true); N2.scal.force('DartBurstFans'); N2.scal.setHp(3);
    k2('c'); k2('z');
    assert.equal(N2.scal.healCd, 15);
  } finally { w2.close(); }
}

{
  const { w, NEU } = make();
  try {
    for (const [tier, amount] of [['bot', 12], ['medium', 6]]) {
      NEU.diff.set(tier); NEU.scal.open();
      NEU.scal.arm(200, 200, 400, 200);
      const before = NEU.scal.hp;
      NEU.scal.hurtBoss(6);
      assert.equal(before - NEU.scal.hp, amount, tier + ' player damage');
    }
  } finally { w.close(); }
}

for (const file of ['fixes695.mjs', 'fixes715.mjs']) {
  const r = spawnSync(process.execPath, ['tests/' + file], { encoding: 'utf8' });
  assert.equal(r.status, 0, file + ' Medium identity:\n' + r.stdout + r.stderr);
}
console.log('ALL PASS (' + tiers.length + ' tiers)');
