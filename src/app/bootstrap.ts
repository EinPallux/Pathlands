// App bootstrap. Expanded incrementally through Phase 1 as systems come online;
// its job is to construct the top-level Game, mount the UI, and dismiss the boot
// screen after the first rendered frame.

export interface AppContext {
  canvas: HTMLCanvasElement;
  uiRoot: HTMLElement;
  onProgress: (pct: number, status?: string) => void;
}

export async function startApp(ctx: AppContext): Promise<void> {
  ctx.onProgress(0.2, 'Assembling the world…');
  const { Game } = await import('./game.ts');
  const game = await Game.create(ctx);
  game.start();
}
