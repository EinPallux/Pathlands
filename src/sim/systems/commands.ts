import type { Sim } from '../context.ts';
import type { Command } from '../commands.ts';
import {
  Control,
  Health,
  Interactable,
  Invulnerable,
  MoveIntent,
  PlayerControlled,
  Transform,
  Velocity,
} from '../components.ts';
import { tryStartCast } from './skills.ts';
import { heal } from '../combat/damage.ts';
import { addBuff } from '../combat/status.ts';
import { getBuff } from '../../content/index.ts';
import { dist } from '../math.ts';

// Translate the player's command stream into simulation effects (ARCHITECTURE.md
// §9). The only entry point for player agency; the same commands will arrive
// over the network in Phase 7.

const DODGE_SPEED = 19;
const POTION_HEAL_FRACTION = 0.4;

export function commandSystem(sim: Sim, commands: readonly Command[]): void {
  const world = sim.world;
  const player = sim.player;
  if (sim.playerDead || !world.isAlive(player)) return;
  const pc = world.get(player, PlayerControlled);
  const intent = world.get(player, MoveIntent);
  const tf = world.get(player, Transform);
  if (!pc || !intent || !tf) return;

  for (const cmd of commands) {
    switch (cmd.kind) {
      case 'moveTo':
        intent.mode = 'to';
        intent.toX = cmd.x;
        intent.toY = cmd.y;
        break;
      case 'moveDir':
        if (cmd.dx !== 0 || cmd.dy !== 0) {
          intent.mode = 'dir';
          intent.dirX = cmd.dx;
          intent.dirY = cmd.dy;
        } else {
          intent.mode = 'stop';
        }
        break;
      case 'stop':
        intent.mode = 'stop';
        break;
      case 'faceTo':
        if (intent.mode === 'stop') tf.facing = Math.atan2(cmd.y - tf.y, cmd.x - tf.x);
        break;
      case 'castSkill':
        tryStartCast(sim, player, cmd.slot, cmd.aimX, cmd.aimY);
        break;
      case 'dodge':
        tryDodge(sim, player, cmd.dx, cmd.dy);
        break;
      case 'usePotion':
        tryPotion(sim, player);
        break;
      case 'interact':
        tryInteract(sim, cmd.entity);
        break;
      case 'pickup':
        // Pickup is resolved by proximity in the pickup system; explicit command
        // is a no-op hint retained for the future networked path.
        break;
      default:
        break;
    }
  }
}

function tryDodge(sim: Sim, player: number, dx: number, dy: number): void {
  const world = sim.world;
  const pc = world.get(player, PlayerControlled)!;
  const ctrl = world.get(player, Control);
  const vel = world.get(player, Velocity);
  if (sim.tick < pc.dodgeCooldownUntil) return;
  if (ctrl && ctrl.stunnedUntil > sim.tick) return;
  const l = Math.hypot(dx, dy);
  const tf = world.get(player, Transform)!;
  let ux: number;
  let uy: number;
  if (l < 1e-3) {
    ux = Math.cos(tf.facing);
    uy = Math.sin(tf.facing);
  } else {
    ux = dx / l;
    uy = dy / l;
  }
  if (vel && ctrl) {
    vel.x = ux * DODGE_SPEED;
    vel.y = uy * DODGE_SPEED;
    ctrl.knockUntil = sim.tick + sim.msToTicks(210);
  }
  world.add(player, Invulnerable, { untilTick: sim.tick + sim.msToTicks(320) });
  pc.dodgeCooldownUntil = sim.tick + sim.msToTicks(1400);
  tf.facing = Math.atan2(uy, ux);
  sim.events.sfx.emit({ cue: 'sfx_dodge', x: tf.x, y: tf.y });
  sim.events.shake.emit({ trauma: 0.08 });
}

function tryPotion(sim: Sim, player: number): void {
  const world = sim.world;
  const pc = world.get(player, PlayerControlled)!;
  const h = world.get(player, Health);
  if (pc.potions <= 0 || sim.tick < pc.potionCooldownUntil || !h) return;
  if (h.current >= h.max) return;
  const restored = heal(world, player, h.max * POTION_HEAL_FRACTION, sim.tick);
  pc.potions -= 1;
  sim.sheet.potions = pc.potions;
  pc.potionCooldownUntil = sim.tick + sim.msToTicks(7000);
  const tf = world.get(player, Transform)!;
  sim.events.floatText.emit({ x: tf.x, y: tf.y, text: `+${Math.round(restored)}`, kind: 'heal' });
  sim.events.sfx.emit({ cue: 'sfx_potion', x: tf.x, y: tf.y });
}

function tryInteract(sim: Sim, entity: number): void {
  const world = sim.world;
  const inter = world.get(entity, Interactable);
  const itf = world.get(entity, Transform);
  const ptf = world.get(sim.player, Transform);
  if (!inter || !itf || !ptf) return;
  if (dist(itf, ptf) > inter.radius + 0.6) return;

  switch (inter.kind) {
    case 'waypoint':
      if (!sim.sheet.waypointsAttuned.includes(inter.id)) {
        sim.sheet.waypointsAttuned.push(inter.id);
      }
      sim.events.zone.emit({ kind: 'waypoint', id: inter.id });
      sim.events.floatText.emit({ x: itf.x, y: itf.y, text: 'Waypoint Attuned', kind: 'info' });
      sim.events.sfx.emit({ cue: 'sfx_waypoint', x: itf.x, y: itf.y });
      break;
    case 'shrine':
      if (inter.used) return;
      inter.used = true;
      addBuff(world, sim.player, getBuff('shrine_empower'), sim.tick);
      sim.events.floatText.emit({ x: itf.x, y: itf.y, text: 'Empowered!', kind: 'info' });
      sim.events.sfx.emit({ cue: 'sfx_shrine', x: itf.x, y: itf.y });
      break;
    default:
      break;
  }
}
