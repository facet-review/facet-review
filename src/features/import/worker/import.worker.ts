import { handle } from './handle';
import type { Envelope, ResultEnvelope, WorkerRequest } from './protocol';

const scope = globalThis as unknown as {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<Envelope<WorkerRequest>>) => void,
  ): void;
  postMessage(message: ResultEnvelope): void;
};

scope.addEventListener('message', (event) => {
  const { id, payload } = event.data;
  try {
    scope.postMessage({ id, ok: true, payload: handle(payload) });
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
