/**
 * Minimal multi-subscriber pub/sub bridged to AsyncIterable — the shape the
 * SessionService contract speaks. Values emitted while a consumer is busy
 * are queued, not dropped.
 */
export class Emitter<T> {
  private subscribers = new Set<(value: T) => void>();

  emit(value: T): void {
    for (const subscriber of [...this.subscribers]) subscriber(value);
  }

  stream(initial?: () => T): AsyncIterable<T> {
    const subscribers = this.subscribers;
    return {
      [Symbol.asyncIterator]() {
        const queue: T[] = [];
        let wake: (() => void) | null = null;
        let done = false;
        const push = (value: T) => {
          queue.push(value);
          wake?.();
        };
        subscribers.add(push);
        if (initial) queue.push(initial());
        return {
          async next(): Promise<IteratorResult<T>> {
            while (queue.length === 0) {
              if (done) return { done: true, value: undefined };
              await new Promise<void>((resolve) => {
                wake = resolve;
              });
              wake = null;
            }
            return { done: false, value: queue.shift()! };
          },
          async return(): Promise<IteratorResult<T>> {
            done = true;
            subscribers.delete(push);
            wake?.();
            return { done: true, value: undefined };
          },
        };
      },
    };
  }
}
