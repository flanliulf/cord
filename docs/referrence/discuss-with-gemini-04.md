Question:

你先提供一个 mock 的本地测试目录数据，然后让 AI 编写一个脚本，自动扫描现有项目生成第一版的 JSON 关系图！


---

Answer:

这是一个非常务实的切入点。在真实的业务场景中，我们很少从零开始写文档，通常面对的都是一个已经存在大量历史文档的仓库。所谓的“冷启动（Cold Start）”问题，就是如何让 AI 快速理解现有存量文档的拓扑结构。

考虑到私域营销和企微接口对接的复杂性，我为你设计了一个高度贴合 SCRM 系统架构的 Mock 目录。我们将通过标准 Markdown 里的相对路径链接 `[文本](相对路径)`，让自动扫描脚本去提取它们之间的双链关系。

### 第一步：创建 Mock 本地测试目录与数据

你可以打开终端，在一个空目录下依次执行以下命令，或者手动创建这些文件：

```bash
# 1. 创建目录结构
mkdir -p docs/api docs/business scripts

# 2. 创建系统总览文档 (Registry 节点)
cat << 'EOF' > docs/architecture.md
# 企微 SCRM 系统架构总览

本文档描述了我们私域营销系统的核心架构。系统主要由以下几个核心模块构成：

- **企微底层网关**: 负责与企业微信官方接口的鉴权与基础通信，详见 [企微网关设计](api/wecom_gateway.md)
- **私域自动化营销**: 负责 SOP 流程引擎与任务下发，详见 [自动化营销引擎](business/auto_marketing.md)
EOF

# 3. 创建企微 API 底层文档 (Detail 节点)
cat << 'EOF' > docs/api/wecom_gateway.md
# 企微网关设计与接口规范

该模块封装了所有企微服务端 API 的调用，包含 Token 刷新机制。

- 相关的限流策略与封号风险控制，请参考业务层的说明：[群发风控策略](../business/risk_control.md)
EOF

# 4. 创建业务逻辑文档 1 (Detail 节点)
cat << 'EOF' > docs/business/auto_marketing.md
# 自动化营销引擎 (SOP)

本模块定义了基于用户标签的自动化触达逻辑。当命中规则时，引擎会调用底层网关发送消息。

- 依赖底层接口定义：[企微网关设计](../api/wecom_gateway.md)
- 依赖风控策略校验：[群发风控策略](risk_control.md)
EOF

# 5. 创建业务逻辑文档 2 (Detail 节点)
cat << 'EOF' > docs/business/risk_control.md
# 群发风控策略与限制

详细定义了单日加好友上限、单日群发次数阈值等企微官方限制规则，避免域名或企微主体被封禁。
EOF
```

### 第二步：编写自动扫描与图谱生成脚本

接下来，我们在项目根目录或 `scripts/` 目录下创建一个名为 `init_graph.py` 的脚本。

这个脚本的核心逻辑是：

1.  遍历 `docs/` 目录下的所有 `.md` 文件。
2.  提取文件第一行的一级标题（`# XXX`）作为节点的 `description`。
3.  使用正则表达式扫描正文中的 Markdown 链接 `[xxx](xxx.md)`。
4.  将相对路径解析为项目根目录下的绝对相对路径（规范化节点 ID）。
5.  自动生成初始的 `doc_graph.json`。

将以下代码保存为 `init_graph.py`：

```python
import os
import re
import json
from datetime import datetime

DOCS_DIR = "docs"
GRAPH_FILE = "doc_graph.json"

# 匹配 Markdown 链接的正则：[描述](相对路径.md)
LINK_PATTERN = re.compile(r'\[([^\]]+)\]\(([^)]+\.md)\)')

def get_doc_title(file_path):
    """尝试读取 Markdown 文件的第一行一级标题作为摘要"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('# '):
                    return line[2:].strip()
        return "未命名文档"
    except Exception as e:
        return f"读取失败: {e}"

def normalize_path(base_file, relative_link):
    """将文档内的相对路径转换为基于项目根目录的标准路径"""
    base_dir = os.path.dirname(base_file)
    # 组合后计算绝对相对路径，如 docs/api/../business/rule.md -> docs/business/rule.md
    normalized = os.path.normpath(os.path.join(base_dir, relative_link))
    # 统一使用正斜杠 (兼容 Windows)
    return normalized.replace('\\', '/')

def scan_project():
    graph = {
        "nodes": {},
        "edges": []
    }
    
    # 第一遍遍历：收集所有节点
    for root, _, files in os.walk(DOCS_DIR):
        for file in files:
            if file.endswith('.md'):
                file_path = os.path.join(root, file).replace('\\', '/')
                title = get_doc_title(file_path)
                
                # 简单启发式判断：如果在根目录，通常是 registry 级别
                doc_type = "registry" if root == DOCS_DIR else "detail"
                
                graph["nodes"][file_path] = {
                    "description": title,
                    "type": doc_type,
                    "updated_at": datetime.now().isoformat()
                }

    # 第二遍遍历：解析正文链接，建立关联边
    for root, _, files in os.walk(DOCS_DIR):
        for file in files:
            if file.endswith('.md'):
                source_path = os.path.join(root, file).replace('\\', '/')
                
                with open(source_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    # 查找所有 Markdown 链接
                    links = LINK_PATTERN.findall(content)
                    for link_text, link_path in links:
                        target_path = normalize_path(source_path, link_path)
                        
                        # 确保目标文件确实存在于节点列表中
                        if target_path in graph["nodes"]:
                            # 初始化关系：正向扫描出的通常是 references 或 depends_on
                            graph["edges"].append({
                                "source": source_path,
                                "target": target_path,
                                "relation_type": "references", 
                                "context": f"文中提到了对 [{link_text}] 的引用",
                                "created_at": datetime.now().isoformat()
                            })

    return graph

def main():
    print("开始扫描文档目录...")
    graph = scan_project()
    
    node_count = len(graph["nodes"])
    edge_count = len(graph["edges"])
    
    with open(GRAPH_FILE, 'w', encoding='utf-8') as f:
        json.dump(graph, f, indent=2, ensure_ascii=False)
        
    print(f"扫描完成！成功写入 {GRAPH_FILE}")
    print(f"共发现节点 (Nodes): {node_count} 个")
    print(f"共发现关系 (Edges): {edge_count} 条")

if __name__ == "__main__":
    main()
```

### 第三步：运行脚本并查看结果

在项目根目录下执行：

```bash
python init_graph.py
```

终端应该会输出：

```text
开始扫描文档目录...
扫描完成！成功写入 doc_graph.json
共发现节点 (Nodes): 4 个
共发现关系 (Edges): 4 条
```

此时，你打开自动生成的 `doc_graph.json`，会看到类似下面的高度结构化数据。这也就是 AI 之后用于理解项目上下文的“图谱大脑”：

```json
{
  "nodes": {
    "docs/architecture.md": {
      "description": "企微 SCRM 系统架构总览",
      "type": "registry",
      "updated_at": "..."
    },
    "docs/api/wecom_gateway.md": {
      "description": "企微网关设计与接口规范",
      "type": "detail",
      "updated_at": "..."
    },
    "docs/business/auto_marketing.md": {
      "description": "自动化营销引擎 (SOP)",
      "type": "detail",
      "updated_at": "..."
    },
    "docs/business/risk_control.md": {
      "description": "群发风控策略与限制",
      "type": "detail",
      "updated_at": "..."
    }
  },
  "edges": [
    {
      "source": "docs/architecture.md",
      "target": "docs/api/wecom_gateway.md",
      "relation_type": "references",
      "context": "文中提到了对 [企微网关设计] 的引用",
      "created_at": "..."
    },
    {
      "source": "docs/business/auto_marketing.md",
      "target": "docs/api/wecom_gateway.md",
      "relation_type": "references",
      "context": "文中提到了对 [企微网关设计] 的引用",
      "created_at": "..."
    }
    // ... 其他关系
  ]
}
```

### 接下来你能做什么？

有了这个基础图谱后，你可以在 AI 辅助编码时抛出一个真实的业务场景测试它。例如，你可以让 AI 读取上文提供的那个 `doc_graph.py`（管理脚本），然后对它下达指令：

*"我准备在自动化营销引擎 (`docs/business/auto_marketing.md`) 中增加一个新的『朋友圈任务下发』逻辑。请你先查询依赖图谱，看看这个修改可能会影响到哪些文件？需不需要同步更新系统的架构总览？"* 由于底层的依赖关系已经被 JSON 捕获，AI 此时就不再是盲人摸象，而是能准确地顺藤摸瓜，告诉你该如何更新对应的 API 规范或风控策略了。

你要不要试试直接在你的环境中跑一下这段逻辑？