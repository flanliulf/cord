import { describe, it, expect } from 'vitest';
import {
  CordError,
  ScanError,
  QueryError,
  ConfigError,
  StorageError,
  AdapterError,
} from '../../../src/utils/errors.js';

describe('CordError', () => {
  it('should create an instance with required properties', () => {
    const err = new CordError({
      message: 'test error',
      code: 'CORD_TEST_001',
      suggestion: 'try again',
    });
    expect(err.message).toBe('test error');
    expect(err.code).toBe('CORD_TEST_001');
    expect(err.suggestion).toBe('try again');
    expect(err.context).toEqual({});
  });

  it('should set context when provided', () => {
    const err = new CordError({
      message: 'test',
      code: 'CORD_TEST_002',
      suggestion: 'fix',
      context: { file: 'foo.md' },
    });
    expect(err.context).toEqual({ file: 'foo.md' });
  });

  it('should set cause when provided', () => {
    const cause = new Error('original');
    const err = new CordError({
      message: 'wrapped',
      code: 'CORD_TEST_003',
      suggestion: 'fix',
      cause,
    });
    expect(err.cause).toBe(cause);
  });

  it('should have name getter returning class name', () => {
    const err = new CordError({
      message: 'test',
      code: 'CORD_TEST_004',
      suggestion: 'fix',
    });
    expect(err.name).toBe('CordError');
  });

  it('should be instanceof Error', () => {
    const err = new CordError({ message: 'x', code: 'X', suggestion: 'y' });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CordError);
  });
});

describe('ScanError', () => {
  it('should default code to CORD_SCAN_000', () => {
    const err = new ScanError({ message: 'scan fail', suggestion: 'check path' });
    expect(err.code).toBe('CORD_SCAN_000');
  });

  it('should accept custom code with CORD_SCAN_ prefix', () => {
    const err = new ScanError({ message: 'fail', suggestion: 'fix', code: 'CORD_SCAN_001' });
    expect(err.code).toBe('CORD_SCAN_001');
  });

  it('should have name ScanError', () => {
    const err = new ScanError({ message: 'x', suggestion: 'y' });
    expect(err.name).toBe('ScanError');
  });

  it('should be instanceof CordError and Error', () => {
    const err = new ScanError({ message: 'x', suggestion: 'y' });
    expect(err).toBeInstanceOf(CordError);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ScanError);
  });

  it('should accept context', () => {
    const err = new ScanError({ message: 'x', suggestion: 'y', context: { root: '/tmp' } });
    expect(err.context).toEqual({ root: '/tmp' });
  });
});

describe('QueryError', () => {
  it('should default code to CORD_QUERY_000', () => {
    const err = new QueryError({ message: 'not found', suggestion: 'check id' });
    expect(err.code).toBe('CORD_QUERY_000');
  });

  it('should have name QueryError', () => {
    const err = new QueryError({ message: 'x', suggestion: 'y' });
    expect(err.name).toBe('QueryError');
  });

  it('should be instanceof CordError', () => {
    const err = new QueryError({ message: 'x', suggestion: 'y' });
    expect(err).toBeInstanceOf(CordError);
    expect(err).toBeInstanceOf(QueryError);
  });
});

describe('ConfigError', () => {
  it('should default code to CORD_CONFIG_000', () => {
    const err = new ConfigError({ message: 'parse fail', suggestion: 'check yaml' });
    expect(err.code).toBe('CORD_CONFIG_000');
  });

  it('should have name ConfigError', () => {
    const err = new ConfigError({ message: 'x', suggestion: 'y' });
    expect(err.name).toBe('ConfigError');
  });

  it('should be instanceof CordError', () => {
    const err = new ConfigError({ message: 'x', suggestion: 'y' });
    expect(err).toBeInstanceOf(CordError);
    expect(err).toBeInstanceOf(ConfigError);
  });
});

describe('StorageError', () => {
  it('should default code to CORD_STORAGE_000', () => {
    const err = new StorageError({ message: 'db fail', suggestion: 'check db path' });
    expect(err.code).toBe('CORD_STORAGE_000');
  });

  it('should have name StorageError', () => {
    const err = new StorageError({ message: 'x', suggestion: 'y' });
    expect(err.name).toBe('StorageError');
  });

  it('should be instanceof CordError', () => {
    const err = new StorageError({ message: 'x', suggestion: 'y' });
    expect(err).toBeInstanceOf(CordError);
    expect(err).toBeInstanceOf(StorageError);
  });
});

describe('AdapterError', () => {
  it('should default code to CORD_ADAPTER_000', () => {
    const err = new AdapterError({ message: 'adapter fail', suggestion: 'check adapter' });
    expect(err.code).toBe('CORD_ADAPTER_000');
  });

  it('should have name AdapterError', () => {
    const err = new AdapterError({ message: 'x', suggestion: 'y' });
    expect(err.name).toBe('AdapterError');
  });

  it('should be instanceof CordError', () => {
    const err = new AdapterError({ message: 'x', suggestion: 'y' });
    expect(err).toBeInstanceOf(CordError);
    expect(err).toBeInstanceOf(AdapterError);
  });
});
