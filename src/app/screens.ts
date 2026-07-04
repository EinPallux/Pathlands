import '../ui/styles/menu.css';
import { SENTINEL } from '../content/classes.ts';
import type { Settings } from '../save/index.ts';
import type { SaveFile } from '../save/model.ts';

// Front-end screen router: main menu, character creation, settings, pause.
// Framework-free DOM, one screen mounted at a time.

const NAME_FIRST = ['Vael', 'Sorrel', 'Bram', 'Kesh', 'Orin', 'Thane', 'Isolde', 'Rook', 'Mera', 'Dain'];
const NAME_LAST = ['Ashwalker', 'the Unbroken', 'Emberhand', 'Gravewatch', 'Pathborn', 'of the Lantern'];

export class Screens {
  private current: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement) {}

  private mount(screen: HTMLElement): void {
    this.clear();
    this.root.appendChild(screen);
    this.current = screen;
  }

  clear(): void {
    this.current?.remove();
    this.current = null;
  }

  showMainMenu(opts: {
    saves: SaveFile[];
    onContinue: (save: SaveFile) => void;
    onNew: () => void;
    onSettings: () => void;
  }): void {
    const s = screen('screen');
    s.innerHTML = `
      <div class="screen-title">PATHLANDS</div>
      <div class="screen-sub">Walk the broken paths</div>
      <div class="menu-buttons"></div>
      <div class="screen-footer">v${__BUILD_VERSION__} — Phase 1: The Broken Gate</div>`;
    const buttons = s.querySelector('.menu-buttons') as HTMLElement;
    const latest = opts.saves[0];
    if (latest) {
      buttons.appendChild(
        button(`Continue — ${latest.sheet.name} (Lv ${latest.sheet.level})`, () => opts.onContinue(latest), true),
      );
    }
    buttons.appendChild(button('New Pathwalker', opts.onNew, !latest));
    buttons.appendChild(button('Settings', opts.onSettings));
    this.mount(s);
  }

  showCharCreate(opts: { onBegin: (name: string) => void; onBack: () => void }): void {
    const s = screen('screen');
    const defaultName = `${rand(NAME_FIRST)} ${rand(NAME_LAST)}`;
    s.innerHTML = `
      <div class="screen-heading">Choose Your Path</div>
      <div class="class-card">
        <div class="class-name">${SENTINEL.name}</div>
        <div class="class-title">${SENTINEL.title}</div>
        <div class="class-fantasy">${SENTINEL.fantasy}</div>
        <div class="class-locked">Stormcaller · Shadowblade · Warden · Ashkeeper — unlocked in Phase 2</div>
      </div>
      <div class="name-row"><input class="name-input" maxlength="24" value="${defaultName}" /></div>
      <div class="menu-buttons"></div>`;
    const input = s.querySelector('.name-input') as HTMLInputElement;
    const buttons = s.querySelector('.menu-buttons') as HTMLElement;
    buttons.appendChild(
      button('Begin the Descent', () => opts.onBegin(input.value.trim() || defaultName), true),
    );
    buttons.appendChild(button('Back', opts.onBack));
    this.mount(s);
  }

  showSettings(opts: {
    settings: Settings;
    overlay?: boolean;
    onChange: (s: Settings) => void;
    onBack: () => void;
  }): void {
    const s = screen(opts.overlay ? 'screen overlay' : 'screen');
    const cur = { ...opts.settings };
    s.innerHTML = `
      <div class="screen-heading">Settings</div>
      ${slider('Master', 'master', cur.master)}
      ${slider('Music', 'music', cur.music)}
      ${slider('Effects', 'sfx', cur.sfx)}
      <div class="settings-row">
        <label>Quality</label>
        <select data-key="quality">
          <option value="low"${cur.quality === 'low' ? ' selected' : ''}>Low</option>
          <option value="medium"${cur.quality === 'medium' ? ' selected' : ''}>Medium</option>
          <option value="high"${cur.quality === 'high' ? ' selected' : ''}>High</option>
        </select>
      </div>
      <div class="menu-buttons"></div>`;
    s.querySelectorAll('input[type=range]').forEach((r) => {
      r.addEventListener('input', () => {
        const key = (r as HTMLElement).dataset.key as 'master' | 'music' | 'sfx';
        cur[key] = Number((r as HTMLInputElement).value) / 100;
        opts.onChange({ ...cur });
      });
    });
    const sel = s.querySelector('select') as HTMLSelectElement;
    sel.addEventListener('change', () => {
      cur.quality = sel.value as Settings['quality'];
      opts.onChange({ ...cur });
    });
    (s.querySelector('.menu-buttons') as HTMLElement).appendChild(button('Back', opts.onBack, true));
    this.mount(s);
  }

  showPause(opts: { onResume: () => void; onSettings: () => void; onQuit: () => void }): void {
    const s = screen('screen overlay');
    s.innerHTML = `<div class="screen-heading">Paused</div><div class="menu-buttons"></div>`;
    const buttons = s.querySelector('.menu-buttons') as HTMLElement;
    buttons.appendChild(button('Resume', opts.onResume, true));
    buttons.appendChild(button('Settings', opts.onSettings));
    buttons.appendChild(button('Save & Quit to Menu', opts.onQuit));
    this.mount(s);
  }
}

function screen(cls: string): HTMLElement {
  const el = document.createElement('div');
  el.className = cls;
  return el;
}

function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = primary ? 'btn primary' : 'btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function slider(label: string, key: string, value: number): string {
  return `<div class="settings-row"><label>${label}</label>
    <input type="range" min="0" max="100" value="${Math.round(value * 100)}" data-key="${key}" /></div>`;
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
