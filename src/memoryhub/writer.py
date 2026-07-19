"""原子写入:把"约定"变"保证"——权威落盘 + Claude 缓存双写 + 增量索引 + 围栏校验
一次调用完成,任一步失败回滚文件操作,三方(权威/缓存/索引)不一致状态不落地。

权威仍是文件:本模块是"代客写文件"而非"写数据库";绕过 API 手改 md 依然合法
(watchdog 对账兜住索引)。对账式增量的幂等性使 watchdog 重复触发天然无害。
"""

from __future__ import annotations

from pathlib import Path

from .config import InstanceConfig
from .scanner import parse_file
from .store import connect, remove_doc, upsert_doc


def claude_cache_root(workspace: Path) -> Path | None:
    """按 MEMORY.md 双写契约推导 Claude 产品缓存 memory 根;该机器无 Claude 缓存则 None。"""
    slug = str(workspace).replace(":", "-").replace("\\", "-").replace("/", "-")
    root = Path.home() / ".claude" / "projects" / slug / "memory"
    return root if root.parent.is_dir() else None


class WriteReport(dict):
    """结果报告(dict 便于直接进 MCP/REST JSON)。"""


def _validate(cfg: InstanceConfig, rel_path: str, content: str) -> list[str]:
    """写前校验:frontmatter 可解析 + 架构组文件跑全量围栏(以"落盘后"的盘面做交叉)。"""
    from .arch import collect
    from .scanner import scan

    errors: list[str] = []
    if not rel_path.endswith(".md"):
        errors.append("只允许写 .md 记忆文件")
        return errors
    target = (cfg.memory_root / rel_path).resolve()
    if not str(target).startswith(str(cfg.memory_root.resolve())):
        errors.append(f"rel_path 越出 memory 根: {rel_path}")
        return errors
    # 以"应用本次写入后的完整盘面"跑架构围栏(R1 交叉/R6 组纯净/R8 anchor 唯一都需全量视角)
    docs = [d for d in scan(cfg.memory_root) if d.rel_path != rel_path.replace("\\", "/")]
    import tempfile

    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td) / Path(rel_path).name
        tmp.write_text(content, encoding="utf-8")
        try:
            doc = parse_file(Path(td), tmp)
        except Exception as exc:
            return [f"文件解析失败: {exc}"]
        # 修正相对路径与组(parse_file 以临时根解析)
        doc.rel_path = rel_path.replace("\\", "/")
        doc.group = doc.rel_path.split("/")[0] if "/" in doc.rel_path else ""
    docs.append(doc)
    _, arch_errors = collect(docs)
    errors.extend(arch_errors)
    return errors


def upsert(cfg: InstanceConfig, rel_path: str, content: str,
           dry_run: bool = False) -> WriteReport:
    errors = _validate(cfg, rel_path, content)
    if errors or dry_run:
        return WriteReport(ok=not errors, dryRun=dry_run, relPath=rel_path, errors=errors)
    auth = cfg.memory_root / rel_path
    backup = auth.read_text(encoding="utf-8") if auth.is_file() else None
    cache_root = claude_cache_root(cfg.workspace)
    cache = cache_root / rel_path if cache_root else None
    try:
        auth.parent.mkdir(parents=True, exist_ok=True)
        auth.write_text(content, encoding="utf-8")
        if cache is not None:
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(content, encoding="utf-8")
        con = connect(cfg.db_path)
        try:
            with con:
                upsert_doc(con, parse_file(cfg.memory_root, auth))
        finally:
            con.close()
    except Exception as exc:
        # 回滚权威文件,不留半成品(缓存与索引以权威为准,回滚后对账自然一致)
        if backup is None:
            auth.unlink(missing_ok=True)
        else:
            auth.write_text(backup, encoding="utf-8")
        if cache is not None:
            if backup is None:
                cache.unlink(missing_ok=True)
            else:
                cache.write_text(backup, encoding="utf-8")
        raise SystemExit(f"写入失败已回滚: {exc}") from exc
    return WriteReport(ok=True, dryRun=False, relPath=rel_path, errors=[],
                       cachedWrite=cache is not None, indexed=True)


def delete(cfg: InstanceConfig, rel_path: str) -> WriteReport:
    auth = cfg.memory_root / rel_path
    if not auth.is_file():
        return WriteReport(ok=False, relPath=rel_path, errors=[f"记忆不存在: {rel_path}"])
    name = auth.stem
    auth.unlink()
    cache_root = claude_cache_root(cfg.workspace)
    removed_cache = False
    if cache_root is not None:
        cache = cache_root / rel_path
        if cache.is_file():
            cache.unlink()
            removed_cache = True
    con = connect(cfg.db_path)
    try:
        with con:
            remove_doc(con, name)
    finally:
        con.close()
    return WriteReport(ok=True, relPath=rel_path, errors=[], cachedWrite=removed_cache)
