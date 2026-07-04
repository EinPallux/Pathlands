import './ui/styles/global.css';

// Boot harness. Owns the loading screen, capability checks, and the global
// error boundary; hands off to the app bootstrap once the platform looks sane.
// Kept deliberately tiny and dependency-free so the very first bytes of JS the
// browser runs can always render a helpful message.

const bootScreen = document.getElementById('boot-screen');
const bootStatus = document.getElementById('boot-status');
const bootBar = document.getElementById('boot-bar-fill');

export function setBootProgress(pct: number, status?: string): void {
  if (bootBar) bootBar.style.width = `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`;
  if (status && bootStatus) bootStatus.textContent = status;
}

function fatal(message: string, detail?: unknown): void {
  console.error('[boot] fatal:', message, detail);
  if (!bootScreen) return;
  bootScreen.classList.remove('hidden');
  bootScreen.innerHTML = `
    <div class="boot-logo">PATHLANDS</div>
    <div class="boot-error">${message}</div>`;
}

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!canvas.getContext('webgl2');
  } catch {
    return false;
  }
}

async function boot(): Promise<void> {
  if (!hasWebGL2()) {
    fatal(
      'Pathlands needs a WebGL2-capable browser. Try a recent version of Chrome, Edge, Firefox, or Safari with hardware acceleration enabled.',
    );
    return;
  }

  setBootProgress(0.05, 'Waking the runtime…');

  try {
    const { startApp } = await import('./app/bootstrap.ts');
    await startApp({
      canvas: document.getElementById('game-canvas') as HTMLCanvasElement,
      uiRoot: document.getElementById('ui-root') as HTMLElement,
      onProgress: setBootProgress,
    });
    // App decides when to dismiss the boot screen (after first frame).
  } catch (err) {
    fatal('Something broke while starting the game. Reload to try again.', err);
  }
}

// Global safety nets so a stray exception shows a message instead of a black screen.
window.addEventListener('error', (e) => console.error('[window] error:', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => console.error('[window] rejection:', e.reason));

void boot();
