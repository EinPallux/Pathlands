import * as THREE from 'three';
import type { Simulation } from '../sim/simulation.ts';
import type { Command } from '../sim/commands.ts';
import { FactionC, Health, Interactable, Transform } from '../sim/components.ts';

// Input → Command translation. Supports both control schemes (GDD §2): WASD to
// move, mouse to aim; OR click/hold-to-move. Left click smart-targets (attack a
// hovered enemy, else move there). Produces the Command stream the sim consumes.

// slot ← key/button mapping (6 skill slots).
const SKILL_KEYS: Record<string, number> = {
  Mouse2: 1, // right click
  KeyQ: 2,
  KeyE: 3,
  KeyR: 4,
  KeyV: 5,
};

export class InputController {
  private readonly held = new Set<string>();
  private readonly justPressed = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private readonly raycaster = new THREE.Raycaster();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly hit = new THREE.Vector3();
  private enabled = true;

  constructor(private readonly canvas: HTMLElement) {
    this.attach();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    // Always clear so stale menu keypresses never leak into gameplay (or back).
    this.held.clear();
    this.justPressed.clear();
  }

  private attach(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.justPressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    this.canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      const code = `Mouse${e.button}`;
      this.held.add(code);
      this.justPressed.add(code);
    });
    window.addEventListener('mouseup', (e) => this.held.delete(`Mouse${e.button}`));
    window.addEventListener('blur', () => this.held.clear());
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Project the cursor onto the ground plane → sim (x, y). */
  private groundCursor(camera: THREE.Camera): { x: number; y: number } {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ndc = new THREE.Vector2((this.mouseX / w) * 2 - 1, -(this.mouseY / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, camera);
    if (this.raycaster.ray.intersectPlane(this.plane, this.hit)) {
      return { x: this.hit.x, y: this.hit.z };
    }
    return { x: 0, y: 0 };
  }

  private nearestEnemyTo(sim: Simulation, x: number, y: number, maxDist: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = maxDist * maxDist;
    for (const [e, fac] of sim.world.view1(FactionC)) {
      if (fac.value !== 'enemy') continue;
      const hlt = sim.world.get(e, Health);
      const tf = sim.world.get(e, Transform);
      if (!hlt || hlt.current <= 0 || !tf) continue;
      const d = (tf.x - x) * (tf.x - x) + (tf.y - y) * (tf.y - y);
      if (d < bestD) {
        bestD = d;
        best = { x: tf.x, y: tf.y };
      }
    }
    return best;
  }

  private nearestInteractable(sim: Simulation): number | null {
    const ptf = sim.world.get(sim.player, Transform);
    if (!ptf) return null;
    let best: number | null = null;
    let bestD = Infinity;
    for (const e of sim.world.entitiesWith(Interactable)) {
      const inter = sim.world.get(e, Interactable);
      const tf = sim.world.get(e, Transform);
      if (!inter || !tf) continue;
      const d = Math.hypot(tf.x - ptf.x, tf.y - ptf.y);
      if (d <= inter.radius + 1 && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** Build this tick's command list. */
  sample(sim: Simulation, camera: THREE.Camera): Command[] {
    if (!this.enabled) {
      this.justPressed.clear();
      return [{ kind: 'stop' }];
    }
    const cmds: Command[] = [];
    const cursor = this.groundCursor(camera);
    const ptf = sim.world.get(sim.player, Transform);

    // Movement: WASD takes priority; else left-click-to-move.
    // Camera looks toward +z, so screen-up (W) is +y and screen-right (D) is +x.
    let dx = 0;
    let dy = 0;
    if (this.held.has('KeyW')) dy += 1;
    if (this.held.has('KeyS')) dy -= 1;
    if (this.held.has('KeyA')) dx -= 1;
    if (this.held.has('KeyD')) dx += 1;
    const wasd = dx !== 0 || dy !== 0;

    // Left click: attack a hovered enemy, else move there.
    const lmb = this.held.has('Mouse0');
    let attackedWithLmb = false;
    if (lmb) {
      const enemy = this.nearestEnemyTo(sim, cursor.x, cursor.y, 2.4);
      if (enemy) {
        cmds.push({ kind: 'castSkill', slot: 0, aimX: enemy.x, aimY: enemy.y });
        attackedWithLmb = true;
      }
    }

    if (wasd) {
      cmds.push({ kind: 'moveDir', dx, dy });
    } else if (lmb && !attackedWithLmb) {
      cmds.push({ kind: 'moveTo', x: cursor.x, y: cursor.y });
    } else {
      cmds.push({ kind: 'faceTo', x: cursor.x, y: cursor.y });
    }

    // Other skill slots (held → repeat, cooldown-gated by the sim).
    for (const [key, slot] of Object.entries(SKILL_KEYS)) {
      if (this.held.has(key)) cmds.push({ kind: 'castSkill', slot, aimX: cursor.x, aimY: cursor.y });
    }

    // Edge-triggered actions.
    if (this.justPressed.has('Space')) {
      let ddx = cursor.x - (ptf?.x ?? 0);
      let ddy = cursor.y - (ptf?.y ?? 0);
      if (wasd) {
        ddx = dx;
        ddy = dy;
      }
      cmds.push({ kind: 'dodge', dx: ddx, dy: ddy });
    }
    if (this.justPressed.has('Digit1')) cmds.push({ kind: 'usePotion', slot: 0 });
    if (this.justPressed.has('KeyF')) {
      const target = this.nearestInteractable(sim);
      if (target !== null) cmds.push({ kind: 'interact', entity: target });
    }

    this.justPressed.clear();
    return cmds;
  }
}
