import { Injectable, type Signal } from '@angular/core';
import type { PreparationRunDto } from '@contracts/ai.contract';

/**
 * Not `providedIn: 'root'`: the poller belongs to the screen that started the run, and a timer
 * that outlives that screen keeps spending the rate limit of a card nobody is looking at.
 */
@Injectable()
export class PreparationRunPoller {
  /** The last state the server reported for the watched run. */
  get run(): Signal<PreparationRunDto | null> {
    throw new Error('Not implemented');
  }

  watch(productId: string, runId: string): void {
    throw new Error('Not implemented');
  }
}
