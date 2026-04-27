/**
 * CordError — base error class for all CORD errors.
 *
 * All errors carry a machine-readable `code`, a human-readable `suggestion`,
 * and an optional `context` bag for structured diagnostic data.
 *
 * Error code format: `CORD_{MODULE}_{NNN}`
 */
export class CordError extends Error {
  /** Machine-readable error code in the format `CORD_{MODULE}_{NNN}`. */
  readonly code: string;

  /** Human-readable hint for resolving the error. */
  readonly suggestion: string;

  /** Structured diagnostic data relevant to the error. */
  readonly context: Record<string, unknown>;

  constructor(params: {
    message: string;
    code: string;
    suggestion: string;
    context?: Record<string, unknown>;
    cause?: Error;
  }) {
    super(params.message, { cause: params.cause });
    this.code = params.code;
    this.suggestion = params.suggestion;
    this.context = params.context ?? {};
  }

  /** Returns the concrete class name (e.g. `ScanError`). */
  override get name(): string {
    return this.constructor.name;
  }
}

// ---------------------------------------------------------------------------
// Shared param type used by all subclasses
// ---------------------------------------------------------------------------

type SubclassParams = Omit<ConstructorParameters<typeof CordError>[0], 'code'> & {
  code?: string;
};

// ---------------------------------------------------------------------------
// Error subclasses
// ---------------------------------------------------------------------------

/**
 * ScanError — raised by the file-system scanner.
 * Default code: `CORD_SCAN_000`
 */
export class ScanError extends CordError {
  constructor(params: SubclassParams) {
    super({ ...params, code: params.code ?? 'CORD_SCAN_000' });
  }
}

/**
 * QueryError — raised when a document query fails or a document is not found.
 * Default code: `CORD_QUERY_000`
 */
export class QueryError extends CordError {
  constructor(params: SubclassParams) {
    super({ ...params, code: params.code ?? 'CORD_QUERY_000' });
  }
}

/**
 * ConfigError — raised when CORD configuration cannot be parsed or is invalid.
 * Default code: `CORD_CONFIG_000`
 */
export class ConfigError extends CordError {
  constructor(params: SubclassParams) {
    super({ ...params, code: params.code ?? 'CORD_CONFIG_000' });
  }
}

/**
 * StorageError — raised by the SQLite storage layer.
 * Default code: `CORD_STORAGE_000`
 */
export class StorageError extends CordError {
  constructor(params: SubclassParams) {
    super({ ...params, code: params.code ?? 'CORD_STORAGE_000' });
  }
}

/**
 * AdapterError — raised when an IDE/framework adapter fails to load or execute.
 * Default code: `CORD_ADAPTER_000`
 */
export class AdapterError extends CordError {
  constructor(params: SubclassParams) {
    super({ ...params, code: params.code ?? 'CORD_ADAPTER_000' });
  }
}
