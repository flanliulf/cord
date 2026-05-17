import { mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SqliteGraphRepository, type IGraphRepository } from '../repositories/index.js';
import { ImpactService, QueryService, RelationService, ScanService } from '../services/index.js';
import { loadConfig, logger } from '../utils/index.js';
import {
  registerAddRelationTool,
  registerAnalyzeImpactTool,
  registerDeprecateRelationTool,
  registerInitGraphTool,
  registerQueryRelationsTool,
  registerRemoveRelationTool,
  registerSyncDocsTool,
} from './tools/index.js';

const PACKAGE_VERSION = '0.1.0';
const CORD_DATA_DIR = '.cord';
const CORD_DB_FILE = 'cord.db';
const SHUTDOWN_TIMEOUT_MS = 2000;

export interface CordMcpRuntime {
  projectRoot: string;
  repository: IGraphRepository;
  queryService: QueryService;
  impactService: ImpactService;
  scanService: ScanService;
  relationService: RelationService;
  close(): void;
}

export interface CordMcpServerInstance {
  server: McpServer;
  runtime: CordMcpRuntime;
  close(): Promise<void>;
}

interface ProcessLike {
  on(event: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): this;
  off?(event: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): this;
  exit(code?: number): never;
}

export function createCordMcpRuntime(options: {
  projectRoot?: string;
  repository?: IGraphRepository;
} = {}): CordMcpRuntime {
  logger.setMode('mcp');

  const projectRoot = options.projectRoot ?? process.cwd();
  const repository = options.repository ?? createDefaultRepository(projectRoot);
  const config = loadConfig(projectRoot);

  return {
    projectRoot,
    repository,
    queryService: new QueryService(repository),
    impactService: new ImpactService(repository, {
      defaultConfidenceThreshold: config.confidenceThreshold,
      updateStrategies: config.updateStrategies,
    }),
    scanService: new ScanService(repository),
    relationService: new RelationService(repository),
    close(): void {
      repository.close();
    },
  };
}

export function createCordMcpServer(options: {
  projectRoot?: string;
  repository?: IGraphRepository;
} = {}): CordMcpServerInstance {
  const runtime = createCordMcpRuntime(options);
  const server = new McpServer({
    name: 'cord',
    version: PACKAGE_VERSION,
  });

  registerAnalyzeImpactTool(server, runtime);
  registerQueryRelationsTool(server, runtime);
  registerInitGraphTool(server, runtime);
  registerSyncDocsTool(server, runtime);
  registerAddRelationTool(server, runtime);
  registerRemoveRelationTool(server, runtime);
  registerDeprecateRelationTool(server, runtime);

  let closed = false;

  return {
    server,
    runtime,
    close: async (): Promise<void> => {
      if (closed) {
        return;
      }

      closed = true;

      try {
        await server.close();
      } finally {
        runtime.close();
      }
    },
  };
}

export async function startCordMcpServer(options: {
  projectRoot?: string;
  repository?: IGraphRepository;
  transport?: Transport;
} = {}): Promise<CordMcpServerInstance & { transport: Transport }> {
  const instance = createCordMcpServer(options);
  const transport = options.transport ?? new StdioServerTransport();
  await instance.server.connect(transport);
  return { ...instance, transport };
}

export function installShutdownHandlers(options: {
  shutdown: () => Promise<void>;
  processApi?: ProcessLike;
  timeoutMs?: number;
  onExit?: (code: number) => void;
  onError?: (message: string, error?: unknown) => void;
}): () => void {
  const processApi = options.processApi ?? process;
  const timeoutMs = options.timeoutMs ?? SHUTDOWN_TIMEOUT_MS;
  const onExit = options.onExit ?? ((code: number) => processApi.exit(code));
  const onError = options.onError ?? ((message: string, error?: unknown) => {
    if (error instanceof Error) {
      console.error(message, error);
      return;
    }

    console.error(message);
  });
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  let shuttingDown = false;

  const listener = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.error(`[cord-mcp] Received ${signal}, shutting down...`);
    const forceTimer = setTimeout(() => {
      onError(`[cord-mcp] Graceful shutdown timed out after ${timeoutMs}ms`);
      onExit(1);
    }, timeoutMs);

    if (typeof forceTimer.unref === 'function') {
      forceTimer.unref();
    }

    void options.shutdown()
      .then(() => {
        clearTimeout(forceTimer);
        console.error('[cord-mcp] Shutdown complete');
        onExit(0);
      })
      .catch((error: unknown) => {
        clearTimeout(forceTimer);
        onError('[cord-mcp] Shutdown failed', error);
        onExit(1);
      });
  };

  for (const signal of signals) {
    processApi.on(signal, listener);
  }

  return (): void => {
    if (typeof processApi.off !== 'function') {
      return;
    }

    for (const signal of signals) {
      processApi.off(signal, listener);
    }
  };
}

export async function runMcpServer(options: {
  projectRoot?: string;
  repository?: IGraphRepository;
  transport?: Transport;
  processApi?: ProcessLike;
  onExit?: (code: number) => void;
} = {}): Promise<CordMcpServerInstance & { transport: Transport; removeShutdownHandlers: () => void }> {
  const instance = await startCordMcpServer(options);
  const removeShutdownHandlers = installShutdownHandlers({
    shutdown: instance.close,
    processApi: options.processApi,
    onExit: options.onExit,
  });

  console.error(`[cord-mcp] Server running on stdio for ${instance.runtime.projectRoot}`);

  return {
    ...instance,
    removeShutdownHandlers,
  };
}

function createDefaultRepository(projectRoot: string): IGraphRepository {
  const dataDirectory = join(projectRoot, CORD_DATA_DIR);
  mkdirSync(dataDirectory, { recursive: true });
  const dbPath = join(dataDirectory, CORD_DB_FILE);
  return new SqliteGraphRepository(dbPath);
}

function reportUnhandledMcpError(error: unknown): void {
  if (error instanceof Error) {
    console.error('[cord-mcp] Unhandled server error', error);
    process.exitCode = 1;
    return;
  }

  console.error('[cord-mcp] Unhandled server error');
  process.exitCode = 1;
}

const entryArg = process.argv[1];
if (entryArg) {
  let entryUrl: string;
  try {
    entryUrl = pathToFileURL(realpathSync(entryArg)).href;
  } catch {
    entryUrl = pathToFileURL(entryArg).href;
  }

  if (import.meta.url === entryUrl) {
    void runMcpServer().catch(reportUnhandledMcpError);
  }
}
