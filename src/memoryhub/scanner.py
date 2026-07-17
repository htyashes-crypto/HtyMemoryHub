"""memory 目录扫描与解析。

主键 = 文件 basename(去扩展名)——权威库"文件名即身份";frontmatter 仅作检索字段,
容错解析(实测存在中文 name / 缺字段 / metadata.type 嵌套两种格式并存)。
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

_FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.DOTALL)
_WIKILINK_RE = re.compile(r"\[\[([^\[\]|]+?)(?:\|[^\[\]]*)?\]\]")


@dataclass
class MemoryDoc:
    name: str            # basename 主键,如 feedback_rootcause_fix
    rel_path: str        # 相对 memory 根,posix 风格
    group: str           # 一级目录名(根下文件为 "")
    display_name: str    # frontmatter name(可中文;缺失回退 basename)
    description: str
    mtype: str           # feedback / project / reference / user / ""
    body: str            # frontmatter 之后的正文
    content_hash: str    # 全文 sha256
    mtime: float
    wikilinks: list[str]


def _parse_frontmatter(text: str) -> tuple[dict, str]:
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    try:
        data = yaml.safe_load(m.group(1))
    except yaml.YAMLError:
        data = None  # frontmatter 损坏:按无 frontmatter 处理,正文仍保留
    return (data if isinstance(data, dict) else {}), text[m.end():]


def _extract_type(fm: dict) -> str:
    mtype = fm.get("type")
    if not mtype and isinstance(fm.get("metadata"), dict):
        mtype = fm["metadata"].get("type")
    return str(mtype).strip() if mtype else ""


def parse_file(memory_root: Path, path: Path) -> MemoryDoc:
    raw = path.read_text(encoding="utf-8", errors="replace")
    fm, body = _parse_frontmatter(raw)
    rel = path.relative_to(memory_root).as_posix()
    parts = rel.split("/")
    return MemoryDoc(
        name=path.stem,
        rel_path=rel,
        group=parts[0] if len(parts) > 1 else "",
        display_name=str(fm.get("name") or path.stem),
        description=str(fm.get("description") or ""),
        mtype=_extract_type(fm),
        body=body.strip(),
        content_hash=hashlib.sha256(raw.encode("utf-8")).hexdigest(),
        mtime=path.stat().st_mtime,
        wikilinks=_WIKILINK_RE.findall(raw),
    )


def scan(memory_root: Path) -> list[MemoryDoc]:
    """全量扫描 memory 根下所有 .md(含根级 MEMORY.md 与各组封面)。"""
    if not memory_root.is_dir():
        raise SystemExit(f"memory 目录不存在: {memory_root}")
    return [parse_file(memory_root, p) for p in sorted(memory_root.rglob("*.md"))]
