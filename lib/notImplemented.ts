/**
 * Contract-first stubs. Every module of the pipeline exists from day one with its final signature
 * and throws NotImplementedError until its owner implements it. The orchestrator treats this error
 * as "stage skipped", so the whole pipeline runs end-to-end and lights up as each lane merges.
 * See docs/module-map.md.
 */
export class NotImplementedError extends Error {
  readonly owner: string;
  readonly issue: number;

  constructor(what: string, owner: string, issue: number) {
    super(`${what} is not implemented yet (owner ${owner}, issue #${issue})`);
    this.name = "NotImplementedError";
    this.owner = owner;
    this.issue = issue;
  }
}

export function notImplemented(what: string, owner: string, issue: number): never {
  throw new NotImplementedError(what, owner, issue);
}

export function isNotImplemented(error: unknown): error is NotImplementedError {
  return error instanceof NotImplementedError;
}
