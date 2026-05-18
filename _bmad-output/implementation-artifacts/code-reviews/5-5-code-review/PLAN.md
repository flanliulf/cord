# Story 5-5 串行执行计划

日期：2026-05-18
Story：5-5-hooks-auto-trigger-and-skills-generation

## 总体目标

按用户要求，使用全新的 sub agent 串行完成 Story 5-5 的开发、代码审查、审查评估、修复循环、规则提炼、TODO 跟踪、Story 收尾，并最终按中文 Conventional Commits 提交代码，不推送。

## 串行步骤

1. 使用全新 sub agent 和 skill `bmad-dev-story` 执行开发，触发形式 `/bmad-dev-story story 5-5`，目标模型 GPT-5.4。
2. 使用全新 sub agent 和 skill `bmenhance-cr-01-reviewer` 执行代码审查，触发形式 `/bmenhance-cr-01-reviewer 5-5`，目标模型 GPT-5.5。
3. 使用全新 sub agent 和 skill `bmenhance-cr-02-evaluator` 评估审查结果，触发形式 `/bmenhance-cr-02-evaluator 5-5`，目标模型 GPT-5.5。
4. 使用全新 sub agent 和 skill `bmenhance-cr-03-fixer` 根据评估结果修复，触发形式 `/bmenhance-cr-03-fixer 5-5`，目标模型 GPT-5.4。
5. 重复步骤 2 到 4，直到 reviewer 结论通过且 evaluator 评估结果通过。
6. 通过后，依次使用全新 sub agent 执行：
   - `bmenhance-cr-04-rules-extractor`
   - `bmenhance-cr-05-todo-tracker`
   - `bmenhance-cr-06-finalizer`
   并按各 skill 输出中的默认推荐决策执行。
7. 使用全新 sub agent 和 skill `git-commit-convention` 提交代码，默认中文，不推送，目标模型 GPT-5.4。

## 执行约束

- 所有步骤严格串行，不并行。
- 每个 skill 内部如需决策，优先采用推荐决策，并在本目录记录原因和结果。
- 每轮审查、评估、修复都写入 `EXPERIMENTS.md`。
- 实时判断、阻塞、默认决策写入 `EXPERIMENT_NOTES.md`。
- 若发生工具能力限制或模型名不可用，记录实际执行方式与影响。

## 当前状态

- 已定位 Story 文件：`_bmad-output/implementation-artifacts/stories/5-5-hooks-auto-trigger-and-skills-generation.md`
- 已创建进度记录目录：`_bmad-output/implementation-artifacts/code-reviews/5-5-code-review/`
- 下一步：启动开发 sub agent。
