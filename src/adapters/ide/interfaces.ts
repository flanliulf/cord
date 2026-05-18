export const IDE_NAMES = ['claude-code', 'cursor', 'vscode-copilot', 'codex-cli'] as const;

export type IdeName = (typeof IDE_NAMES)[number];

export interface SkillsArtifact {
  targetPath: string;
  content: string;
}

export interface IIdeAdapter {
  readonly name: IdeName;

  detect(projectRoot: string): boolean;

  generateMcpConfig(projectRoot: string): void;

  generateInstructionFile(projectRoot: string): void;

  generateHooksConfig?(projectRoot: string): void;

  generateSkills?(targetDir: string): SkillsArtifact[];
}