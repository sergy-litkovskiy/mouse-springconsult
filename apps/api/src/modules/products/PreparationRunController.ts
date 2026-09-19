import type { FastifyInstance, preHandlerAsyncHookHandler } from 'fastify';
import type { PreparationRunService } from './PreparationRunService.ts';

export class PreparationRunController {
  constructor(private readonly preparations: PreparationRunService) {}

  register(app: FastifyInstance, sessionGuard: preHandlerAsyncHookHandler): void {
    throw new Error('Not implemented');
  }
}
