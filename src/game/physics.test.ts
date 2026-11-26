import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBirdBody,
  createBlockBody,
  createPhysicsWorld,
  createPigBody,
  predictTrajectory,
  stepPhysicsWorld,
  triggerBirdAbility,
} from './physics';
import { computeStars, LEVELS, SLINGSHOT_ORIGIN } from './levels';

test('predictTrajectory produces a valid parabolic arc descending with gravity', () => {
  const pts = predictTrajectory(SLINGSHOT_ORIGIN, { x: 20, y: 12, z: 0 }, -19.5, 25, 0.08);
  assert.ok(pts.length > 8);
  assert.ok(pts[0].x > SLINGSHOT_ORIGIN.x);
  const peakY = Math.max(...pts.map((p) => p.y));
  assert.ok(peakY > SLINGSHOT_ORIGIN.y + 2);
});

test('sphere bounces off ground plane with restitution and never sinks below radius', () => {
  const world = createPhysicsWorld(-19.5);
  const bird = createBirdBody('b1', 'red', 0, 5, 0);
  bird.launched = true;
  world.bodies.push(bird);

  for (let i = 0; i < 90; i++) {
    stepPhysicsWorld(world, 1 / 60);
  }

  assert.ok(bird.position.y >= bird.radius - 0.03, `Expected y >= ${bird.radius}, got ${bird.position.y}`);
});

test('glass breaks under moderate bird impact while stone resists the same light impact', () => {
  const worldGlass = createPhysicsWorld(-19.5);
  const glass = createBlockBody('g1', 5, 1.0, 0, 0.5, 2.0, 2.0, 'glass');
  const bird1 = createBirdBody('b1', 'red', 3.5, 1.0, 0);
  bird1.launched = true;
  bird1.velocity = { x: 16, y: 0, z: 0 };
  worldGlass.bodies.push(glass, bird1);

  const worldStone = createPhysicsWorld(-19.5);
  const stone = createBlockBody('s1', 5, 1.0, 0, 0.5, 2.0, 2.0, 'stone');
  const bird2 = createBirdBody('b2', 'red', 3.5, 1.0, 0);
  bird2.launched = true;
  bird2.velocity = { x: 16, y: 0, z: 0 };
  worldStone.bodies.push(stone, bird2);

  for (let i = 0; i < 30; i++) {
    stepPhysicsWorld(worldGlass, 1 / 60);
    stepPhysicsWorld(worldStone, 1 / 60);
  }

  assert.equal(glass.alive, false, 'Glass should shatter on direct impact');
  assert.equal(stone.alive, true, 'Stone should survive moderate red bird hit');
});

test('yellow bird boost accelerates velocity and black bird explosion destroys nearby stone & pigs', () => {
  const world = createPhysicsWorld(-19.5);
  const yellow = createBirdBody('y1', 'yellow', 0, 6, 0);
  yellow.launched = true;
  yellow.velocity = { x: 12, y: 2, z: 0 };
  world.bodies.push(yellow);

  triggerBirdAbility(world, yellow);
  assert.ok(yellow.velocity.x > 25, 'Yellow boost should substantially increase forward speed');

  const stone = createBlockBody('s1', 10, 1, 0, 1.2, 2.0, 1.2, 'stone');
  const pig = createPigBody('p1', 12, 0.6, 0, 0.6, 'grunt');
  const black = createBirdBody('k1', 'black', 11, 1.2, 0);
  black.launched = true;
  world.bodies.push(stone, pig, black);

  const events = triggerBirdAbility(world, black);
  assert.ok(events.some((e) => e.type === 'explosion'));
  assert.equal(pig.alive, false, 'Nearby pig should pop in explosion');
  assert.equal(stone.alive, false, 'Nearby stone should shatter in black bird blast');
});

test('all 3 level fortresses remain standing with all pigs alive during idle settling', () => {
  for (const lvl of LEVELS) {
    const world = createPhysicsWorld(-19.5);
    lvl.blocks.forEach((b, idx) => {
      const body = createBlockBody(`blk-${idx}`, b.x, b.y, b.z, b.w, b.h, b.d, b.material, b.ry ?? 0);
      body.isSleeping = false;
      world.bodies.push(body);
    });
    lvl.pigs.forEach((p, idx) => {
      const pig = createPigBody(`pig-${idx}`, p.x, p.y, p.z, p.radius, p.variant);
      pig.isSleeping = false;
      world.bodies.push(pig);
    });

    for (let i = 0; i < 120; i++) {
      stepPhysicsWorld(world, 1 / 60);
    }

    const alivePigs = world.bodies.filter((b) => b.kind === 'pig' && b.alive).length;
    assert.equal(
      alivePigs,
      lvl.pigs.length,
      `Level ${lvl.id} (${lvl.name}) lost a pig while idle!`,
    );
  }
});

test('computeStars returns 0..3 stars matching level thresholds', () => {
  const th: [number, number, number] = [10000, 20000, 30000];
  assert.equal(computeStars(5000, th), 0);
  assert.equal(computeStars(10000, th), 1);
  assert.equal(computeStars(25000, th), 2);
  assert.equal(computeStars(35000, th), 3);
});

test('high-velocity bird impact wakes fortress and triggers chain-reaction collapse', () => {
  const lvl = LEVELS[0];
  const world = createPhysicsWorld(-19.5);
  lvl.blocks.forEach((b, idx) => {
    world.bodies.push(
      createBlockBody(`blk-${idx}`, b.x, b.y, b.z, b.w, b.h, b.d, b.material, b.ry ?? 0),
    );
  });
  lvl.pigs.forEach((p, idx) => {
    world.bodies.push(createPigBody(`pig-${idx}`, p.x, p.y, p.z, p.radius, p.variant));
  });

  const bird = createBirdBody('hero', 'black', 6.5, 2.5, 0);
  bird.launched = true;
  bird.velocity = { x: 24, y: 1.5, z: 0 };
  world.bodies.push(bird);

  let destroyedCount = 0;
  for (let i = 0; i < 150; i++) {
    const events = stepPhysicsWorld(world, 1 / 60);
    for (const ev of events) {
      if (ev.type === 'destroy' || ev.type === 'pig_pop') destroyedCount++;
    }
  }
  assert.ok(destroyedCount >= 1, 'Direct heavy strike should destroy glass/blocks or pop pigs');
});

