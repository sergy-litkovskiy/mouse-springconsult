import { DestroyRef, Injectable, inject, signal, type Signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import type { PreparationRunDto } from '@contracts/ai.contract';
import { ProductsApi } from './products-api';

/** A run finishes in tens of seconds, so the state is asked for often enough to feel immediate. */
const POLL_INTERVAL_MS = 2_000;

/**
 * Not `providedIn: 'root'`: the poller belongs to the screen that started the run, and a timer
 * that outlives that screen keeps spending the rate limit of a card nobody is looking at.
 */
@Injectable()
export class PreparationRunPoller {
  private readonly api = inject(ProductsApi);
  private readonly state = signal<PreparationRunDto | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** The last state the server reported for the watched run. */
  get run(): Signal<PreparationRunDto | null> {
    return this.state.asReadonly();
  }

  watch(productId: string, runId: string): void {
    this.stop();
    this.ask(productId, runId);
  }

  private ask(productId: string, runId: string): void {
    this.pending = this.api.getPreparationRun(productId, runId).subscribe({
      next: (run) => {
        this.pending = null;
        this.state.set(run);
        if (run.status === 'queued' || run.status === 'running') {
          this.timer = setTimeout(() => this.ask(productId, runId), POLL_INTERVAL_MS);
        }
      },
      // Asking again is what was refused in the first place, and every ask is paid for; the
      // screen cannot tell a dead poll from a dead run, and to the admin both mean the same.
      error: () => {
        this.pending = null;
        const current = this.state();
        if (current !== null) {
          this.state.set({ ...current, status: 'failed', errorCode: 'preparation_failed' });
        }
      },
    });
  }

  private stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending?.unsubscribe();
    this.pending = null;
  }
}
