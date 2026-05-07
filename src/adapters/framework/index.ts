import type { CordConfig } from '../../types/index.js';
import { ConfigError } from '../../utils/index.js';
import { GenericFrameworkAdapter } from './generic/adapter.js';
import type { IFrameworkAdapter } from './interfaces.js';

export { AbstractFrameworkAdapter } from './abstract-base.js';
export { GenericFrameworkAdapter } from './generic/adapter.js';
export type { DocTypeDefinition, IFrameworkAdapter, PresetRule } from './interfaces.js';

/** 框架适配器声明式注册表；Generic 必须始终位于末尾作为兜底。 */
export const frameworkAdapters: IFrameworkAdapter[] = [new GenericFrameworkAdapter()];

/**
 * 根据显式配置或自动检测解析当前项目应使用的框架适配器。
 *
 * @param config - 已加载的 CORD 配置
 * @param projectRoot - 项目根目录
 * @param registry - 适配器注册表，测试可注入自定义顺序
 * @returns 命中的框架适配器实例
 * @throws {@link ConfigError} 当显式指定的适配器不存在或没有任何适配器命中时抛出
 */
export function resolveAdapter(
	config: CordConfig,
	projectRoot: string,
	registry: readonly IFrameworkAdapter[] = frameworkAdapters,
): IFrameworkAdapter {
	if (config.framework) {
		const explicitAdapter = registry.find((adapter) => adapter.name === config.framework);

		if (explicitAdapter) {
			return explicitAdapter;
		}

		throw new ConfigError({
			message: `Unknown framework adapter: ${config.framework}`,
			code: 'CORD_CONFIG_004',
			suggestion: `Use one of: ${registry.map((adapter) => adapter.name).join(', ')}, or omit framework for auto-detection.`,
			context: {
				framework: config.framework,
				availableAdapters: registry.map((adapter) => adapter.name),
			},
		});
	}

	const detectedAdapter = registry.find((adapter) => adapter.detectFramework(projectRoot));

	if (detectedAdapter) {
		return detectedAdapter;
	}

	throw new ConfigError({
		message: 'No framework adapter matched the current project.',
		code: 'CORD_CONFIG_005',
		suggestion: 'Register at least one framework adapter or set config.framework explicitly.',
		context: {
			projectRoot,
			availableAdapters: registry.map((adapter) => adapter.name),
		},
	});
}
