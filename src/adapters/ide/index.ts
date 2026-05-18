import { ConfigError } from '../../utils/index.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import { CodexCliAdapter } from './codex-cli.js';
import { collectDetectedIdes, resolveDetectedIde } from './detector.js';
import { CursorAdapter } from './cursor.js';
import type { IIdeAdapter, IdeName } from './interfaces.js';
import { VscodeCopilotAdapter } from './vscode-copilot.js';

export { ClaudeCodeAdapter } from './claude-code.js';
export { CodexCliAdapter } from './codex-cli.js';
export {
	IDE_DETECTION_PRIORITY,
	collectDetectedIdes,
	detectClaudeCode,
	detectCodexCli,
	detectCursor,
	detectVscodeCopilot,
	resolveDetectedIde,
} from './detector.js';
export { CursorAdapter } from './cursor.js';
export type { IIdeAdapter, IdeName, SkillsArtifact } from './interfaces.js';
export { IDE_NAMES } from './interfaces.js';
export { VscodeCopilotAdapter } from './vscode-copilot.js';

export const ideAdapters: IIdeAdapter[] = [
	new ClaudeCodeAdapter(),
	new CursorAdapter(),
	new VscodeCopilotAdapter(),
	new CodexCliAdapter(),
];

export function resolveIdeAdapter(options: {
	projectRoot: string;
	explicitIde?: IdeName;
	registry?: readonly IIdeAdapter[];
}): IIdeAdapter {
	const registry = options.registry ?? ideAdapters;

	if (options.explicitIde) {
		const explicitAdapter = registry.find((adapter) => adapter.name === options.explicitIde);

		if (explicitAdapter) {
			return explicitAdapter;
		}

		throw new ConfigError({
			message: `Unknown IDE adapter: ${options.explicitIde}`,
			code: 'CORD_CONFIG_008',
			suggestion: 'Use one of: claude-code, cursor, vscode-copilot, codex-cli.',
			context: {
				explicitIde: options.explicitIde,
			},
		});
	}

	const detectedIde = resolveDetectedIde(options.projectRoot);
	const detectedAdapter = registry.find((adapter) => adapter.name === detectedIde);

	if (detectedAdapter) {
		return detectedAdapter;
	}

	throw new ConfigError({
		message: `No registered IDE adapter matched detected IDE: ${detectedIde}`,
		code: 'CORD_CONFIG_009',
		suggestion: 'Register the adapter in src/adapters/ide/index.ts before resolving it.',
		context: {
			detectedIde,
			detectedIdes: collectDetectedIdes(options.projectRoot),
		},
	});
}
