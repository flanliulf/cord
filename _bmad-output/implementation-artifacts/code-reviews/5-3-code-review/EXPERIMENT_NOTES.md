# Story 5-3 Experiment Notes

Date: 2026-05-18

## Live Notes

- Located Story 5-3 at `_bmad-output/implementation-artifacts/stories/5-3-ide-adapter-and-auto-detection.md`.
- Sprint status currently marks `5-3-ide-adapter-and-auto-detection` as `ready-for-dev`.
- CR directory follows `_bmad-output/implementation-artifacts/code-reviews/5-3-code-review/`.
- Next action: run development sub agent with `/bmad-dev-story story 5-3` using GPT-5.4 High.
- Runtime model availability check failed for `GPT-5.4 High`; closest available model is `GPT-5.4 (copilot)`. Per user instruction to prefer recommended decisions and avoid waiting, continue with `GPT-5.4 (copilot)` and record this fallback.
- Decision: keep Story 5.3 scoped to the adapter layer itself (`src/adapters/ide/**`) and not pre-implement `cord init` orchestration; no current consumer of `src/adapters/ide` existed in `src/**`, so adapter-first was the smallest root-cause slice.
- Decision: use `.github/copilot-instructions.md` + `.vscode/mcp.json` for VS Code Copilot, following the project research contract; this still satisfies the Story's `copilot-instructions.md + AGENTS.md + MCP Host` requirement without inventing a non-standard path.
- Decision: for IDE-owned config files (`.claude/settings.json`, `.cursor/mcp.json`, `.vscode/mcp.json`), use create-if-absent / same-content no-op / explicit-conflict on diff to preserve NFR12 zero-intrusion.
- Decision: treat `AGENTS.md` as the only appendable exception, using a shared `<!-- CORD:START --> ... <!-- CORD:END -->` block so Copilot and Codex CLI can converge on one shared artifact instead of competing blocks.
- Decision: for Claude Code, generate `.claude/rules/cord-relations.md` as the primary CORD-owned instruction file, and create `CLAUDE.md` only when absent as a minimal `@.claude/rules/cord-relations.md` bootstrap wrapper to satisfy Story AC while preserving existing `CLAUDE.md` content.
- Runtime model availability does not include `GPT-5.5 High`; closest available model is `GPT-5.5 (copilot)`. Continue CR reviewer/evaluator with `GPT-5.5 (copilot)`.
- CR Round 1 reviewer completed with `GPT-5.5 (copilot)` and wrote `_bmad-output/implementation-artifacts/code-reviews/5-3-code-review/5-3-code-review-summary-20260518-round-1.md`.
- CR conclusion: not passed. Findings: decision_needed=0, patch=2, defer=0. Blocking issue: VS Code Copilot uses unconditional write for `.github/copilot-instructions.md`, violating zero-intrusion when the file already exists; secondary issue: `AGENTS.md` existing CORD-block update trims content outside the CORD section.
- Recommended next step: run CR evaluator, then fixer if evaluator confirms the patch findings.
- CR evaluator Round 1 completed with `GPT-5.5 (copilot)` and wrote `_bmad-output/implementation-artifacts/code-reviews/5-3-code-review/5-3-code-review-evaluation-20260518-round-1.md`.
- Evaluation conclusion: Changes Required / not approved. Confirmed 2 valid findings, 0 false positives, 0 discussion-only items.
- Fixer should handle: (1) make VS Code Copilot instruction writing non-invasive for existing `.github/copilot-instructions.md`; (2) update `AGENTS.md` CORD-block replacement to preserve all content outside the CORD block byte-for-byte, with tests for both paths.
- Fixer executed with `GPT-5.4 (copilot)`: changed `src/adapters/ide/vscode-copilot.ts` to use `writeProtectedFile()` for `.github/copilot-instructions.md`, and changed `src/adapters/ide/shared.ts` to replace only the marker-bounded CORD block while preserving all surrounding bytes.
- Added two focused tests in `tests/unit/adapters/ide.test.ts`: existing Copilot instructions file must not be overwritten, and repeated `AGENTS.md` upsert must preserve content outside the CORD block byte-for-byte.
- Validation status: `npm test -- --run tests/unit/adapters/ide.test.ts` passed; `npm run type-check` and `npm run lint` first exposed one new unused import in `src/adapters/ide/vscode-copilot.ts`, and both passed after removing that import.
- CR reviewer Round 2 completed with `GPT-5.5 (copilot)` and wrote `_bmad-output/implementation-artifacts/code-reviews/5-3-code-review/5-3-code-review-summary-20260518-round-2.md`.
- Round 2 conclusion: passed. Findings: decision_needed=0, patch=0, defer=0. The two Round 1 P1 items are verified closed, and no new blocker or medium/high issue was found.
- CR evaluator Round 2 completed with `GPT-5.5 (copilot)` and wrote `_bmad-output/implementation-artifacts/code-reviews/5-3-code-review/5-3-code-review-evaluation-20260518-round-2.md`.
- Evaluation conclusion: Approved / passed. The two Round 1 P1 items are confirmed closed, required fixes=0, no CR TODO remains, and no fixer is needed; the CR loop can terminate.
- Finalization sub agent first launch failed with HTTP 408 request-body timeout before execution. Retry with a shorter prompt.
- Finalization rerun uses actual available model `GPT-5.4 (copilot)`; requested High tier is unavailable in this runtime.
- CR rules extractor result: analysis-only. No new Story 5-3 rule should be written to `cr-rules-summary.md`, because both extracted candidates are already covered by existing global NFR12 / `AGENTS.md` appendable rules and this Story only fixed implementation drift against those rules.
- TODO tracker result: no TODO extracted and no relevant open backlog item matched Story 5-3 file scope (`src/adapters/ide/**`, `AGENTS.md`, `.github/copilot-instructions.md`).
- Finalizer result: latest evaluation is Approved, but Story file and sprint-status were already `done` before this pass, so 06 becomes an idempotent confirmation rather than a new state mutation.
- `_bmad-output/planning-artifacts/bmm-workflow-status.yaml` does not exist in this repository; per skill rule, skip workflow-state sync without blocking finalization.
- Epic 5 is not all done because `5-4-initservice-one-click-init-cord-init` and `5-5-hooks-auto-trigger-and-skills-generation` remain unfinished; do not update `epic-5` to done.
- Next action: perform a Story 5-3 scoped local commit only, then append the resulting commit hash/message back into these progress files.

## Validation Commands

- `npm test -- --run tests/unit/adapters/ide.test.ts`
- `npm run type-check`
- `npm run lint`
- `npm test`
- `npm test -- --run tests/unit/adapters/ide.test.ts` (fixer re-run, passed)
- `npm run type-check` (fixer first run failed on unused import; second run passed)
- `npm run lint` (fixer first run failed on unused import; second run passed)
- `npm test -- --run tests/unit/adapters/ide.test.ts` (round 2 reviewer re-run, passed 13/13)
- `npm run type-check` (round 2 reviewer re-run, passed)
- `npm run lint` (round 2 reviewer re-run, passed)
- `npm test` (round 2 reviewer re-run, passed 402/402)

