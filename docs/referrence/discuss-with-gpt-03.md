Question:

你先提供一个 mock 的本地测试目录数据，然后让 AI 编写一个脚本，自动扫描现有项目生成第一版的 JSON 关系图！

--- 

Answer：

下面我先给你一套 **mock 本地测试目录数据**（含示例文档内容与典型链接/锚点/托管块），再给你一个 **扫描脚本**：自动遍历项目 Markdown，抽取 `doc_id/kind/module`、显式链接、anchor，并生成第一版 `doc-graph.json`。

---

## 1) Mock 本地测试目录（建议你直接用脚本一键生成）

目录结构（生成后大概长这样）：

```text
mock_repo/
  README.md
  CLAUDE.md
  docs/
    api/
      overview.md
      modules/
        payments.md
        orders.md
    architecture/
      system-overview.md
    adr/
      ADR-0001-api-style.md
    glossary.md
    schema/
      payments-schema.md
```

### 一键生成 mock_repo 的脚本：`create_mock_repo.py`

把下面代码保存为 `create_mock_repo.py`，然后执行：
`python create_mock_repo.py ./mock_repo`

```python
import os
from pathlib import Path

FILES = {
    "README.md": """---
doc_id: DOC.readme
kind: README
domain: project
---

# 项目说明

- API 总览见：docs/api/overview.md
- 架构总览见：docs/architecture/system-overview.md
""",

    "CLAUDE.md": """---
doc_id: DOC.claude.rules
kind: AI_RULES
domain: governance
---

# AI 规则

当你修改 docs/ 下任意文档后，应更新 doc graph（后续由工具/脚本完成）。
""",

    "docs/api/overview.md": """---
doc_id: DOC.api.overview
kind: API_OVERVIEW
domain: api
---

# API 总览

本文件用于列出所有模块 API 的入口清单，细节请进入各模块文档。

<!-- anchor: api-inventory -->

<!-- docgraph:begin id=api-inventory module=all -->
## 模块清单（工具托管块）

- [支付模块 API](modules/payments.md)
- [订单模块 API](modules/orders.md)

<!-- docgraph:end id=api-inventory -->

> 规范要求见：[ADR-0001](../adr/ADR-0001-api-style.md)
""",

    "docs/api/modules/payments.md": """---
doc_id: DOC.api.module.payments
kind: API_MODULE
domain: api
module: payments
---

# 支付模块 API

<!-- anchor: endpoints -->

## Endpoints

| method | path | summary |
|---|---|---|
| POST | /payments | 创建支付 |
| GET | /payments/{id} | 查询支付 |

相关数据结构见：[支付数据模型](../../schema/payments-schema.md#payments)
术语见：[术语表](../../glossary.md)

""",

    "docs/api/modules/orders.md": """---
doc_id: DOC.api.module.orders
kind: API_MODULE
domain: api
module: orders
---

# 订单模块 API

## Endpoints

| method | path | summary |
|---|---|---|
| POST | /orders | 创建订单 |
| GET | /orders/{id} | 查询订单 |

""",

    "docs/architecture/system-overview.md": """---
doc_id: DOC.arch.system_overview
kind: ARCHITECTURE
domain: architecture
---

# 系统架构总览

API 设计参见：[API 总览](../api/overview.md)

一致性要求参见：[ADR-0001](../adr/ADR-0001-api-style.md)
""",

    "docs/adr/ADR-0001-api-style.md": """---
doc_id: DOC.adr.0001.api_style
kind: ADR
domain: governance
---

# ADR-0001 API 风格约定

- 路径命名、错误码风格等
- 本 ADR 对所有 API 文档具有一致性约束

受影响文档示例：
- [API 总览](../api/overview.md)
- [支付模块 API](../api/modules/payments.md)
""",

    "docs/glossary.md": """---
doc_id: DOC.glossary
kind: GLOSSARY
domain: governance
---

# 术语表

- Payment：支付
- Order：订单
""",

    "docs/schema/payments-schema.md": """---
doc_id: DOC.schema.payments
kind: SCHEMA
domain: data
module: payments
---

# 支付数据模型

<!-- anchor: payments -->

字段示例（略）
""",
}

def write_file(root: Path, rel_path: str, content: str):
    p = root / rel_path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")

def main(out_dir: str):
    root = Path(out_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)

    for rel, content in FILES.items():
        write_file(root, rel, content)

    print(f"Mock repo created at: {root}")

if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "./mock_repo"
    main(out)
```

---

## 2) 扫描脚本：自动生成第一版 JSON 关系图

特点（第一版就够用）：

* 扫描项目内 `*.md`
* 解析 YAML front matter：`doc_id/kind/module/domain/title/tags/references`
* 抽取 anchors：

  * `<!-- anchor: xxx -->`
  * `<!-- docgraph:begin id=xxx ... -->`（托管块作为 block anchor）
  * Markdown 标题（heading anchor，弱）
* 抽取显式链接关系：`[text](relative/path.md#anchor)`
* 规则推断（少量但实用）：

  * `API_OVERVIEW -> API_MODULE` 的链接默认标为 `enumerates_items_from`（否则就是 `cites`）
  * `ADR -> (其他文档)` 的链接默认标为 `must_be_consistent_with`（可按你规则改）

把下面代码保存为 `docgraph_scan.py`，执行：
`python docgraph_scan.py --root ./mock_repo --out ./mock_repo/doc-graph.json`

```python
import argparse
import hashlib
import json
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# -----------------------------
# Front matter parsing
# -----------------------------
def parse_front_matter(text: str) -> Tuple[Dict, str]:
    """
    Returns (front_matter_dict, body_text).
    Tries PyYAML if available; otherwise uses a minimal parser for simple YAML.
    """
    if not text.startswith("---\n"):
        return {}, text

    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text

    fm_raw = text[4:end]
    body = text[end + 5 :]

    # Try PyYAML if installed
    try:
        import yaml  # type: ignore
        fm = yaml.safe_load(fm_raw) or {}
        if not isinstance(fm, dict):
            fm = {}
        return fm, body
    except Exception:
        pass

    # Minimal fallback: key: value, key: [a,b], and dash lists
    fm: Dict = {}
    lines = fm_raw.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line or line.strip().startswith("#"):
            i += 1
            continue

        m = re.match(r"^([A-Za-z0-9_\-]+)\s*:\s*(.*)$", line)
        if not m:
            i += 1
            continue

        key, rest = m.group(1), m.group(2).strip()
        if rest == "":
            # Possibly a list in subsequent lines
            items = []
            j = i + 1
            while j < len(lines):
                lm = re.match(r"^\s*-\s*(.+)\s*$", lines[j])
                if not lm:
                    break
                items.append(lm.group(1).strip())
                j += 1
            fm[key] = items
            i = j
            continue

        # Inline list
        if rest.startswith("[") and rest.endswith("]"):
            inner = rest[1:-1].strip()
            fm[key] = [x.strip().strip('"').strip("'") for x in inner.split(",") if x.strip()]
        else:
            fm[key] = rest.strip().strip('"').strip("'")
        i += 1

    return fm, body


# -----------------------------
# Anchor extraction
# -----------------------------
ANCHOR_EXPLICIT_RE = re.compile(r"<!--\s*anchor:\s*([A-Za-z0-9._:\-]+)\s*-->")
DOCGRAPH_BEGIN_RE = re.compile(r"<!--\s*docgraph:begin\s+id=([A-Za-z0-9._:\-]+)([^>]*)-->")
DOCGRAPH_END_RE = re.compile(r"<!--\s*docgraph:end\s+id=([A-Za-z0-9._:\-]+)\s*-->")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)

def slugify_heading(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^\w\u4e00-\u9fff\s\-]", "", s)
    s = re.sub(r"\s+", "-", s)
    return s[:80] if s else "heading"

def parse_docgraph_attrs(attr_str: str) -> Dict[str, str]:
    # Parses ` key=value key2=value2`
    attrs: Dict[str, str] = {}
    for token in attr_str.strip().split():
        if "=" in token:
            k, v = token.split("=", 1)
            attrs[k.strip()] = v.strip()
    return attrs


# -----------------------------
# Link extraction
# -----------------------------
# captures: text, target
MD_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")

def is_md_file(target: str) -> bool:
    t = target.split("#", 1)[0]
    return t.endswith(".md")

def normalize_rel_path(src_path: Path, target: str) -> Tuple[Optional[Path], Optional[str]]:
    """
    Resolve a markdown link target to an absolute path (if local), and extract anchor (if any).
    Returns (abs_path_or_none, anchor_or_none)
    """
    if "://" in target or target.startswith("mailto:"):
        return None, None

    parts = target.split("#", 1)
    rel = parts[0]
    anchor = parts[1] if len(parts) == 2 else None

    if not rel:
        # link to same file anchor only
        return src_path.resolve(), anchor

    # strip query
    rel = rel.split("?", 1)[0]

    abs_path = (src_path.parent / rel).resolve()
    return abs_path, anchor


# -----------------------------
# Data models
# -----------------------------
@dataclass
class Node:
    doc_id: str
    path: str
    title: str
    kind: str
    module: Optional[str]
    domain: Optional[str]
    content_hash: str
    meta: Dict
    anchors: List[Dict]

@dataclass
class Edge:
    id: str
    src: str
    dst: str
    type: str
    src_anchor: Optional[str]
    dst_anchor: Optional[str]
    status: str
    confidence: float
    meta: Dict
    evidence: List[Dict]


# -----------------------------
# Scanner
# -----------------------------
DEFAULT_IGNORES = {".git", "node_modules", "target", "dist", "build", ".idea", ".vscode", ".next"}

def sha256_bytes(b: bytes) -> str:
    return "sha256:" + hashlib.sha256(b).hexdigest()

def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace")

def detect_title(fm: Dict, body: str) -> str:
    if isinstance(fm.get("title"), str) and fm["title"].strip():
        return fm["title"].strip()
    m = re.search(r"^\s*#\s+(.+?)\s*$", body, flags=re.MULTILINE)
    return m.group(1).strip() if m else p_stem_title(body)

def p_stem_title(body: str) -> str:
    return "Untitled"

def iter_markdown_files(root: Path) -> List[Path]:
    files: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # prune ignores
        dirnames[:] = [d for d in dirnames if d not in DEFAULT_IGNORES]
        for fn in filenames:
            if fn.lower().endswith(".md"):
                files.append(Path(dirpath) / fn)
    return sorted(files)

def build_nodes(root: Path, files: List[Path]) -> Tuple[List[Node], Dict[Path, Node], Dict[str, Path]]:
    nodes: List[Node] = []
    by_path: Dict[Path, Node] = {}
    by_doc_id: Dict[str, Path] = {}

    for fp in files:
        raw = fp.read_bytes()
        content = raw.decode("utf-8", errors="replace")
        fm, body = parse_front_matter(content)

        doc_id = str(fm.get("doc_id") or "").strip()
        if not doc_id:
            # fallback: stable-ish id from relative path
            rel = fp.relative_to(root).as_posix()
            doc_id = "DOC.path." + hashlib.sha1(rel.encode("utf-8")).hexdigest()[:12]

        kind = str(fm.get("kind") or "UNKNOWN").strip()
        module = str(fm.get("module") or "").strip() or None
        domain = str(fm.get("domain") or "").strip() or None
        title = detect_title(fm, body)

        # anchors
        anchors: List[Dict] = []
        # explicit anchors
        for m in ANCHOR_EXPLICIT_RE.finditer(content):
            anchors.append({
                "anchor_id": m.group(1),
                "type": "explicit",
                "title": None
            })
        # docgraph blocks (managed blocks)
        for m in DOCGRAPH_BEGIN_RE.finditer(content):
            block_id = m.group(1)
            attrs = parse_docgraph_attrs(m.group(2))
            anchors.append({
                "anchor_id": block_id,
                "type": "block",
                "title": attrs.get("title"),
                "attrs": attrs
            })
        # headings
        for m in HEADING_RE.finditer(body):
            h_title = m.group(2).strip()
            anchors.append({
                "anchor_id": slugify_heading(h_title),
                "type": "heading",
                "title": h_title
            })

        node = Node(
            doc_id=doc_id,
            path=fp.relative_to(root).as_posix(),
            title=title,
            kind=kind,
            module=module,
            domain=domain,
            content_hash=sha256_bytes(raw),
            meta={k: v for k, v in fm.items() if k not in {"doc_id", "kind", "module", "domain", "title"}},
            anchors=anchors,
        )
        nodes.append(node)
        by_path[fp.resolve()] = node
        by_doc_id[doc_id] = fp.resolve()

    return nodes, by_path, by_doc_id

def classify_edge(src_node: Node, dst_node: Node) -> Tuple[str, str, float]:
    """
    Returns (type, status, confidence)
    Deterministic rules for first version.
    """
    # API overview -> API module : enumerate
    if src_node.kind == "API_OVERVIEW" and dst_node.kind == "API_MODULE":
        return "enumerates_items_from", "AUTO_CONFIRMED", 1.0

    # ADR links impose consistency constraint (very common governance pattern)
    if src_node.kind == "ADR" and dst_node.kind in {"API_OVERVIEW", "API_MODULE", "ARCHITECTURE", "SCHEMA"}:
        return "must_be_consistent_with", "AUTO_CONFIRMED", 1.0

    # Otherwise: normal citation
    return "cites", "AUTO_CONFIRMED", 0.9

def build_edges(root: Path, files: List[Path], by_path: Dict[Path, Node]) -> List[Edge]:
    edges: List[Edge] = []
    seen = set()

    for fp in files:
        src_abs = fp.resolve()
        src_node = by_path.get(src_abs)
        if not src_node:
            continue

        content = read_text(fp)
        fm, body = parse_front_matter(content)

        for m in MD_LINK_RE.finditer(body):
            link_text = m.group(1).strip()
            target = m.group(2).strip()

            abs_target, anchor = normalize_rel_path(fp, target)
            if not abs_target or not is_md_file(target):
                continue
            dst_node = by_path.get(abs_target.resolve())
            if not dst_node:
                continue

            edge_type, status, conf = classify_edge(src_node, dst_node)

            # de-dup key
            key = (src_node.doc_id, dst_node.doc_id, edge_type, anchor or "")
            if key in seen:
                continue
            seen.add(key)

            edges.append(Edge(
                id=str(uuid.uuid4()),
                src=src_node.doc_id,
                dst=dst_node.doc_id,
                type=edge_type,
                src_anchor=None,
                dst_anchor=anchor.lstrip("#") if anchor else None,
                status=status,
                confidence=conf,
                meta={
                    "link_text": link_text,
                    "raw_target": target
                },
                evidence=[
                    {"type": "explicit_link", "detail": {"from": src_node.path, "to": dst_node.path}}
                ]
            ))

        # front matter references (optional)
        refs = fm.get("references")
        if isinstance(refs, list):
            for ref in refs:
                if not isinstance(ref, str):
                    continue
                # interpret as path
                abs_ref, anchor = normalize_rel_path(fp, ref)
                if abs_ref and abs_ref.resolve() in by_path:
                    dst_node = by_path[abs_ref.resolve()]
                    edge_type, status, conf = "cites", "AUTO_CONFIRMED", 0.9
                    key = (src_node.doc_id, dst_node.doc_id, edge_type, anchor or "")
                    if key in seen:
                        continue
                    seen.add(key)
                    edges.append(Edge(
                        id=str(uuid.uuid4()),
                        src=src_node.doc_id,
                        dst=dst_node.doc_id,
                        type=edge_type,
                        src_anchor=None,
                        dst_anchor=anchor.lstrip("#") if anchor else None,
                        status=status,
                        confidence=conf,
                        meta={"raw_target": ref, "from_front_matter": True},
                        evidence=[{"type": "front_matter", "detail": {"key": "references"}}],
                    ))

    return edges

def export_json(nodes: List[Node], edges: List[Edge], out_path: Path):
    payload = {
        "version": 1,
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "nodes": [
            {
                "doc_id": n.doc_id,
                "path": n.path,
                "title": n.title,
                "kind": n.kind,
                "module": n.module,
                "domain": n.domain,
                "content_hash": n.content_hash,
                "meta": n.meta,
                "anchors": n.anchors,
            }
            for n in nodes
        ],
        "edges": [
            {
                "id": e.id,
                "src": e.src,
                "dst": e.dst,
                "type": e.type,
                "src_anchor": e.src_anchor,
                "dst_anchor": e.dst_anchor,
                "status": e.status,
                "confidence": e.confidence,
                "meta": e.meta,
                "evidence": e.evidence,
            }
            for e in edges
        ],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="项目根目录")
    ap.add_argument("--out", required=True, help="输出 JSON 文件路径")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    out = Path(args.out).resolve()

    files = iter_markdown_files(root)
    nodes, by_path, _ = build_nodes(root, files)
    edges = build_edges(root, files, by_path)

    export_json(nodes, edges, out)
    print(f"Scanned {len(nodes)} docs, {len(edges)} relations")
    print(f"Wrote: {out}")

if __name__ == "__main__":
    main()
```

---

## 3) 你运行后的预期效果（示例）

在 mock_repo 上跑完，你会看到类似关系：

* `DOC.api.overview -> DOC.api.module.payments`
  `type=enumerates_items_from`（因为 overview -> module）
* `DOC.adr.0001.api_style -> DOC.api.overview`
  `type=must_be_consistent_with`（因为 ADR -> API 文档）
* `DOC.api.module.payments -> DOC.schema.payments`
  `type=cites`
* `DOC.arch.system_overview -> DOC.api.overview`
  `type=cites`

输出文件：`mock_repo/doc-graph.json`

---

## 4) 下一步增强（你很快就会需要的 3 个改动）

如果你确认第一版 OK，建议马上做这三件事（都很小改动，但收益巨大）：

1. **托管块同步元数据落边**：扫描 `docgraph:begin id=...` 时把 `target_block_id` 写进 `enumerates_items_from` 的 `meta`
2. **新增“新增模块自动收录”的聚合边**：在 `API_OVERVIEW` 上生成一条 `aggregates_from`（query=kind:API_MODULE, domain:api）
3. **做 impact_analysis**：当某个 doc hash 变化时，查所有 `dst=changed_doc` 的边，标记 `stale=true` 或生成 patch

---

如果你把你真实项目里 **API 模块文档的目录约定**（比如 `docs/api/modules/**`）和 **overview 托管块格式**（你现在用表格还是列表）告诉我，我可以直接把上面脚本改成“对你项目即插即用”的版本：

* 自动识别“API endpoint 列表”并生成 overview 托管块内容
* 输出 `sync_state` 所需字段（为后续 autopatch/propose_patch 做准备）
