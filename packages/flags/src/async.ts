export class DeadlineError extends Error {}

/** Bounds caller waiting. SDK requests must also have their own transport timeout. */
export function withinDeadline<T>(
  work: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () =>
        finish(() => reject(new DeadlineError("Flag evaluation timed out"))),
      timeoutMs,
    );
    const abort = () =>
      finish(() => reject(new Error("Flag request cancelled")));
    function finish(settle: () => void) {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      settle();
    }
    // Attach both handlers even when already aborted; late SDK rejections remain handled.
    work.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => {
        if (error instanceof Error) {
          finish(() => reject(error));
          return;
        }
        finish(() => reject(new Error("Flag request failed")));
      },
    );
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

export function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`);
  return value;
}

export function report<T>(
  callback: ((event: T) => void) | undefined,
  event: T,
): void {
  // Diagnostics must not turn a successful flag decision into an application error.
  try {
    callback?.(event);
  } catch {
    /* The host owns its logging failures. */
  }
}
