import './styles/hud.css';
import type { Simulation } from '../sim/simulation.ts';
import { Boss, Health, PlayerControlled, Resource, SkillUser } from '../sim/components.ts';
import { getBoss, getSkill } from '../content/index.ts';
import { xpToNext } from '../sim/character.ts';
import { SIM_HZ } from '../sim/constants.ts';

// The in-game HUD. Built once, updated directly from the simulation each frame
// (no React on the hot path, per CLAUDE.md §2). Event-driven bits (toasts, death
// overlay, boss name) come through syncTick after each sim step.

const SLOT_KEYS = ['LMB', 'RMB', 'Q', 'E', 'R', 'V'];

export class Hud {
  private readonly root: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healthText: HTMLElement;
  private readonly resFill: HTMLElement;
  private readonly resText: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly lvlText: HTMLElement;
  private readonly goldText: HTMLElement;
  private readonly slots: HTMLElement[] = [];
  private readonly cds: HTMLElement[] = [];
  private readonly cdTexts: HTMLElement[] = [];
  private readonly potionCount: HTMLElement;
  private readonly bossBar: HTMLElement;
  private readonly bossName: HTMLElement;
  private readonly bossHpFill: HTMLElement;
  private readonly bossPips: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly toastLayer: HTMLElement;
  private readonly deathOverlay: HTMLElement;
  private readonly deathSub: HTMLElement;
  readonly numberLayer: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly sim: Simulation,
  ) {
    this.root = el('div', 'hud');
    this.root.innerHTML = `
      <div class="hud-vignette"></div>
      <div class="boss-bar hidden">
        <div class="boss-name"></div>
        <div class="boss-hp"><div class="boss-hp-fill"></div></div>
        <div class="boss-pips"></div>
      </div>
      <div class="hud-info">
        <span class="lvl"></span>
        <span class="gold"></span>
        <span class="hint">WASD / click move · LMB attack · RMB Q E R V skills · Space dodge · 1 potion · F interact</span>
      </div>
      <div class="hud-bottom">
        <div class="orb orb-health"><div class="orb-fill"></div><div class="orb-gloss"></div><span class="orb-text"></span></div>
        <div class="skillbar"></div>
        <div class="orb orb-resource"><div class="orb-fill"></div><div class="orb-gloss"></div><span class="orb-text"></span></div>
      </div>
      <div class="xp-bar"><div class="xp-fill"></div></div>
      <div class="toast-layer"></div>
      <div class="death-overlay"><div class="death-title">YOU DIED</div><div class="death-sub"></div></div>
      <div class="number-layer"></div>`;
    parent.appendChild(this.root);

    const q = (s: string): HTMLElement => this.root.querySelector(s) as HTMLElement;
    this.healthFill = q('.orb-health .orb-fill');
    this.healthText = q('.orb-health .orb-text');
    this.resFill = q('.orb-resource .orb-fill');
    this.resText = q('.orb-resource .orb-text');
    this.xpFill = q('.xp-fill');
    this.lvlText = q('.lvl');
    this.goldText = q('.gold');
    this.bossBar = q('.boss-bar');
    this.bossName = q('.boss-name');
    this.bossHpFill = q('.boss-hp-fill');
    this.bossPips = q('.boss-pips');
    this.vignette = q('.hud-vignette');
    this.toastLayer = q('.toast-layer');
    this.deathOverlay = q('.death-overlay');
    this.deathSub = q('.death-sub');
    this.numberLayer = q('.number-layer');

    const bar = q('.skillbar');
    for (let i = 0; i < 6; i++) {
      const slot = el('div', 'skill-slot');
      slot.innerHTML = `<span class="skill-key">${SLOT_KEYS[i]}</span><span class="skill-glyph"></span><div class="skill-cd"><span class="skill-cd-text"></span></div>`;
      bar.appendChild(slot);
      this.slots.push(slot);
      this.cds.push(slot.querySelector('.skill-cd') as HTMLElement);
      this.cdTexts.push(slot.querySelector('.skill-cd-text') as HTMLElement);
    }
    const potion = el('div', 'potion-slot');
    potion.innerHTML = `<span class="skill-key">1</span><span class="potion-count">3</span>`;
    bar.appendChild(potion);
    this.potionCount = potion.querySelector('.potion-count') as HTMLElement;

    this.refreshSkillGlyphs();
  }

  private refreshSkillGlyphs(): void {
    const su = this.sim.world.get(this.sim.player, SkillUser);
    for (let i = 0; i < 6; i++) {
      const slot = this.slots[i]!;
      const glyph = slot.querySelector('.skill-glyph') as HTMLElement;
      const skillId = su?.slots[i]?.skillId;
      if (skillId) {
        slot.classList.remove('empty');
        glyph.textContent = glyphFor(skillId);
      } else {
        slot.classList.add('empty');
        glyph.textContent = '';
      }
    }
  }

  /** Event-driven updates after each sim step. */
  syncTick(): void {
    for (const z of this.sim.events.zone.all) {
      if (z.kind === 'bossSpawn') {
        const def = getBoss(z.id);
        this.toast(`${def.name.toUpperCase()} — ${def.title}`);
      } else if (z.kind === 'waypoint') {
        this.toast('Waypoint Attuned');
      } else if (z.kind === 'areaClear') {
        this.toast('The Reach is Cleared');
      } else if (z.kind === 'bossPhase') {
        this.toast('The gate shudders…');
      }
    }
    for (const l of this.sim.events.levelUp.all) this.toast(`Level ${l.level}`);
    if (this.sim.playerDead) {
      for (const d of this.sim.events.died.all) {
        if (d.rank === 'player') this.deathSub.textContent = 'The Paths reclaim you. Rising again…';
      }
    }
    // Keep glyphs in sync as skills unlock on level-up.
    this.refreshSkillGlyphs();
  }

  update(): void {
    const world = this.sim.world;
    const player = this.sim.player;
    const h = world.get(player, Health);
    const r = world.get(player, Resource);
    const pc = world.get(player, PlayerControlled);
    const su = world.get(player, SkillUser);

    if (h) {
      const frac = Math.max(0, h.current / h.max);
      this.healthFill.style.height = `${frac * 100}%`;
      this.healthText.textContent = `${Math.max(0, Math.ceil(h.current))}`;
      this.vignette.style.opacity = frac < 0.35 ? String((0.35 - frac) / 0.35) : '0';
    }
    if (r) {
      const frac = r.max > 0 ? r.current / r.max : 0;
      this.resFill.style.height = `${frac * 100}%`;
      this.resText.textContent = `${Math.floor(r.current)}`;
    }

    const lvl = this.sim.sheet.level;
    this.lvlText.textContent = `${this.sim.sheet.name} — Level ${lvl}`;
    this.goldText.textContent = `⟡ ${this.sim.sheet.gold} gold`;
    this.xpFill.style.width = `${Math.min(100, (this.sim.sheet.xp / xpToNext(lvl)) * 100)}%`;
    if (pc) this.potionCount.textContent = `${pc.potions}`;

    // Skill cooldowns + resource affordability.
    if (su) {
      for (let i = 0; i < 6; i++) {
        const slot = su.slots[i];
        const cdEl = this.cds[i]!;
        const cdText = this.cdTexts[i]!;
        if (!slot || !slot.skillId) {
          cdEl.style.height = '0%';
          cdText.textContent = '';
          continue;
        }
        const skill = getSkill(slot.skillId);
        const remaining = slot.cooldownUntil - this.sim.tick;
        if (remaining > 0 && skill.cooldownMs > 0) {
          const total = Math.max(1, (skill.cooldownMs / 1000) * SIM_HZ);
          cdEl.style.height = `${Math.min(100, (remaining / total) * 100)}%`;
          const secs = remaining / SIM_HZ;
          cdText.textContent = secs >= 0.5 ? secs.toFixed(1) : '';
        } else {
          cdEl.style.height = '0%';
          cdText.textContent = '';
        }
        const cost = skill.resourceCost;
        this.slots[i]!.classList.toggle('nores', cost > 0 && !!r && r.current < cost);
      }
    }

    // Boss bar.
    const bossAlive = world.isAlive(this.sim.bossEntity) && this.sim.bossEngaged;
    if (bossAlive) {
      const bh = world.get(this.sim.bossEntity, Health);
      const bd = world.get(this.sim.bossEntity, Boss);
      if (bh && bd) {
        this.bossBar.classList.remove('hidden');
        if (!this.bossName.textContent) {
          const def = getBoss(bd.defId);
          this.bossName.textContent = `${def.name} — ${def.title}`;
          this.bossPips.innerHTML = def.phases.map(() => '<span class="boss-pip"></span>').join('');
        }
        this.bossHpFill.style.width = `${Math.max(0, (bh.current / bh.max) * 100)}%`;
        const pips = this.bossPips.querySelectorAll('.boss-pip');
        pips.forEach((p, idx) => p.classList.toggle('on', idx <= bd.phase));
      }
    } else {
      this.bossBar.classList.add('hidden');
    }

    this.deathOverlay.classList.toggle('show', this.sim.playerDead);
  }

  private toast(text: string): void {
    const t = el('div', 'toast');
    t.textContent = text;
    this.toastLayer.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  dispose(): void {
    this.root.remove();
  }
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}

function glyphFor(skillId: string): string {
  const name = getSkill(skillId).name;
  const words = name.split(' ');
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
