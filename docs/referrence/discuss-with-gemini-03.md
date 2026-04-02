Question:

可以，请提供


---

Answer：

这是一个非常实用的起点。为了让 Claude Code 能够直接调用，我们将采用 **CLI (命令行接口) + JSON 存储** 的架构。AI Agent 极其擅长通过命令行传递参数并解析 JSON 格式的返回结果。

下面是一个完整的、可直接运行的 Python 脚本（Agent Skill），以及如何将其与 `CLAUDE.md` 结合的完整落地方案。

### 1\. 核心控制脚本：`doc_graph.py`

请在你的项目根目录（或 `scripts/` 目录下）创建这个 `doc_graph.py` 文件。它充当了关系图谱的“微型数据库引擎”。

```python
import json
import os
import argparse
from datetime import datetime

GRAPH_FILE = "doc_graph.json"

def load_graph():
    if not os.path.exists(GRAPH_FILE):
        return {"nodes": {}, "edges": []}
    with open(GRAPH_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_graph(graph):
    with open(GRAPH_FILE, "w", encoding="utf-8") as f:
        json.dump(graph, f, indent=2, ensure_ascii=False)

def add_node(file_path, description, doc_type="general"):
    graph = load_graph()
    graph["nodes"][file_path] = {
        "description": description,
        "type": doc_type,
        "updated_at": datetime.now().isoformat()
    }
    save_graph(graph)
    print(json.dumps({"status": "success", "message": f"节点 {file_path} 已记录"}))

def add_edge(source, target, relation_type, context):
    graph = load_graph()
    # 确保节点存在
    if source not in graph["nodes"]:
        add_node(source, "自动创建的占位节点")
    if target not in graph["nodes"]:
        add_node(target, "自动创建的占位节点")
        
    # 检查是否已存在相同的边，避免重复
    for edge in graph["edges"]:
        if edge["source"] == source and edge["target"] == target and edge["relation_type"] == relation_type:
            edge["context"] = context # 更新上下文
            save_graph(graph)
            print(json.dumps({"status": "success", "message": "关系已更新"}))
            return
            
    graph["edges"].append({
        "source": source,
        "target": target,
        "relation_type": relation_type,
        "context": context,
        "created_at": datetime.now().isoformat()
    })
    save_graph(graph)
    print(json.dumps({"status": "success", "message": f"关系 {source} -> {target} 已建立"}))

def query_links(file_path, direction="both"):
    graph = load_graph()
    results = []
    
    for edge in graph["edges"]:
        if direction in ["out", "both"] and edge["source"] == file_path:
            target_info = graph["nodes"].get(edge["target"], {})
            results.append({
                "direction": "outgoing",
                "relation_type": edge["relation_type"],
                "target_doc": edge["target"],
                "target_desc": target_info.get("description", ""),
                "context": edge["context"]
            })
        if direction in ["in", "both"] and edge["target"] == file_path:
            source_info = graph["nodes"].get(edge["source"], {})
            results.append({
                "direction": "incoming",
                "relation_type": edge["relation_type"],
                "source_doc": edge["source"],
                "source_desc": source_info.get("description", ""),
                "context": edge["context"]
            })
            
    print(json.dumps({"target_file": file_path, "links": results}, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="文档双链图谱管理器")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # add_node 命令
    parser_add_node = subparsers.add_parser("add_node", help="添加或更新文档节点")
    parser_add_node.add_argument("file_path", help="文档路径")
    parser_add_node.add_argument("description", help="文档摘要")
    parser_add_node.add_argument("--type", default="general", help="文档类型 (如 registry, detail)")

    # add_edge 命令
    parser_add_edge = subparsers.add_parser("add_edge", help="添加或更新文档关系")
    parser_add_edge.add_argument("source", help="源文档路径")
    parser_add_edge.add_argument("target", help="目标文档路径")
    parser_add_edge.add_argument("relation_type", help="关系类型 (如 detailed_in, depends_on)")
    parser_add_edge.add_argument("context", help="关系上下文描述")

    # query 命令
    parser_query = subparsers.add_parser("query", help="查询文档关联")
    parser_query.add_argument("file_path", help="文档路径")
    parser_query.add_argument("--direction", choices=["in", "out", "both"], default="both", help="查询方向")

    args = parser.parse_args()

    if args.command == "add_node":
        add_node(args.file_path, args.description, args.type)
    elif args.command == "add_edge":
        add_edge(args.source, args.target, args.relation_type, args.context)
    elif args.command == "query":
        query_links(args.file_path, args.direction)
    else:
        parser.print_help()
```

### 2\. 测试工具（场景模拟）

你可以直接在终端中测试这个脚本，模拟在企微私域营销系统开发中，AI 可能会执行的操作：

**步骤 1：记录总览文档与具体模块文档**

```bash
python doc_graph.py add_node "docs/scrm_architecture.md" "SCRM系统整体架构与核心模块总览" --type "registry"
python doc_graph.py add_node "docs/wechat_msg_api.md" "企微消息群发模块的详细API定义与限制" --type "detail"
```

**步骤 2：建立双链关系**

```bash
python doc_graph.py add_edge "docs/wechat_msg_api.md" "docs/scrm_architecture.md" "detailed_in" "企微消息群发模块的API细节在此文档，需要同步在架构总览中暴露入口"
```

**步骤 3：模拟 AI 查询影响范围**
假设现在要修改架构文档，AI 会先执行查询：

```bash
python doc_graph.py query "docs/scrm_architecture.md" --direction in
```

系统会返回 JSON，告知 AI 有哪些底层文档挂载在这个架构文档上，从而决定是否需要级联读取。

-----

### 3\. CLAUDE.md 核心魔法配置

只有脚本是不够的，关键在于如何利用 `CLAUDE.md` 赋予 AI “自动维护上下文”的意识。请在项目根目录的 `CLAUDE.md` 中加入以下极其明确的规则：

```markdown
# 知识图谱与文档双链维护规则 (极其重要)

本项目使用 `doc_graph.py` 维护所有 Markdown 文档的依赖拓扑图。为了防止上下文腐化，你必须遵守以下铁律：

## 1. 强制关系写入
每当你在项目中**创建**或**修改**了任何技术文档（`.md`），你必须在回答用户之前，使用终端调用 `python doc_graph.py` 记录或更新它的引用关系。
- 记录节点：`python doc_graph.py add_node "<file_path>" "<description>"`
- 记录边：`python doc_graph.py add_edge "<source>" "<target>" "<relation_type>" "<context>"`

## 2. 标准 relation_type 字典
- `detailed_in`: 当 A 文档是 B 文档的更详细说明时使用（A detailed_in B）。
- `depends_on`: 当 A 模块的代码/逻辑依赖 B 模块时使用。
- `implements`: 当 A 文档（如代码说明）实现了 B 文档（如 PRD/规范）时使用。

## 3. 级联更新策略 (Cascading Updates)
如果你准备修改一个文档的接口定义或核心逻辑，你必须先执行：
`python doc_graph.py query "<file_path>"`
仔细阅读返回的 JSON 关系树。如果发现有被依赖的文档（如 API 总目录），你必须**主动**去更新那个总目录文档，保持数据一致性。
```

### 总结

这套方案极其轻量，零部署成本。JSON 文件会被直接提交到 Git 中，这使得整个开发团队（包括 AI）看到的文档关系始终与当前代码分支保持绝对一致。

你要不要在本地初始化一个测试目录跑一下这几个命令，看看 Claude Code 是如何阅读并严格执行这些钩子动作的？如果运行顺畅，我们后续甚至可以让 AI 编写一个脚本，自动扫描现有项目生成第一版的 JSON 关系图！