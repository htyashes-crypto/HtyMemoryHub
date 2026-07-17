"""索引编排:全量/增量 reindex(scan → hash 差集 → store 更新)。

watchdog 目录监控在 Step 6 并入本模块。
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

from .config import InstanceConfig
from .scanner import scan
from .store import (
    META_FINGERPRINT,
    current_hashes,
    docs_missing_chunks,
    ensure_vec_table,
    get_meta,
    purge_vector_layer,
    remove_doc,
    replace_doc_chunks,
    set_meta,
    upsert_doc,
)

# 切块阈值(字符;中文记忆 1 字≈1 token,2200 字符≈计划的 1500 token 量级)
# 块总长上界 = _SUB_LIMIT + description 前缀长度(全库实测 worst 3168 字符,
# 远低于各家 embedding API 输入限制 8K token)
_CHUNK_LIMIT = 2200
_SUB_LIMIT = 2600


def _split_oversize(text: str, limit: int) -> list[str]:
    """分级细分保证每块 ≤limit:空行段 → 单行 → 字符硬切;先细分合规再贪心聚合。"""
    if len(text) <= limit:
        return [text]
    for sep in ("\n\n", "\n"):
        parts = [p for p in text.split(sep) if p]
        if len(parts) > 1:
            units = [u for p in parts for u in _split_oversize(p, limit)]
            packed: list[str] = []
            buf = ""
            for u in units:
                if buf and len(buf) + len(sep) + len(u) > limit:
                    packed.append(buf)
                    buf = u
                else:
                    buf = f"{buf}{sep}{u}" if buf else u
            if buf:
                packed.append(buf)
            return packed
    return [text[i:i + limit] for i in range(0, len(text), limit)]


def chunk_body(description: str, body: str) -> list[str]:
    """≤阈值整篇单块;超长按 `## ` 标题切并分级细分,块前缀 description 作上下文。"""
    prefix = f"{description}\n" if description else ""
    full = prefix + body
    if len(full) <= _CHUNK_LIMIT:
        return [full] if full.strip() else []
    sections: list[str] = []
    for i, part in enumerate(body.split("\n## ")):
        text = part if i == 0 else "## " + part
        sections.extend(_split_oversize(text, _SUB_LIMIT))
    return [prefix + s for s in sections if s.strip()]


@dataclass
class ReindexStats:
    total: int
    added: int
    updated: int
    removed: int

    def summary(self) -> str:
        return (f"{self.total} docs(新增 {self.added} / 更新 {self.updated}"
                f" / 删除 {self.removed})")


def reindex_keyword(con: sqlite3.Connection, cfg: InstanceConfig) -> ReindexStats:
    """关键词层(documents+fts)的全量对账式增量:hash 相同跳过,盘上消失的删除。"""
    docs = scan(cfg.memory_root)
    known = current_hashes(con)
    added = updated = 0
    with con:
        for doc in docs:
            old = known.pop(doc.name, None)
            if old == doc.content_hash:
                continue
            upsert_doc(con, doc)
            if old is None:
                added += 1
            else:
                updated += 1
        for stale in known:  # 库里有、盘上无 → 已删除/改名
            remove_doc(con, stale)
        set_meta(con, "last_indexed", datetime.now(timezone.utc).isoformat())
    return ReindexStats(len(docs), added, updated, len(known))


def fingerprint(cfg: InstanceConfig) -> str:
    e = cfg.embedding
    assert e is not None
    return f"{e.base_url}|{e.model}|{e.dim}"


def reindex_vectors(con: sqlite3.Connection, cfg: InstanceConfig,
                    force: bool = False) -> tuple[int, int]:
    """向量层增量:嵌入所有"缺块"文档(新增/内容变更被级联清块的)。

    模型指纹守卫:与库内指纹不符时拒绝增量(避免两种模型的向量混库),
    须 --force 清空向量层全量重嵌。返回 (docs, chunks) 数。
    """
    from .embedder import embed_texts

    assert cfg.embedding is not None
    cur_fp = fingerprint(cfg)
    stored_fp = get_meta(con, META_FINGERPRINT)
    if stored_fp is not None and stored_fp != cur_fp:
        if not force:
            raise SystemExit(
                f"embedding 配置已变({stored_fp} → {cur_fp}),与库内向量不符;"
                f"请跑 memoryhub reindex --force 清空向量层重建"
            )
        with con:
            purge_vector_layer(con)
    with con:
        ensure_vec_table(con, cfg.embedding.dim)
        set_meta(con, META_FINGERPRINT, cur_fp)
    pending = docs_missing_chunks(con)
    doc_count = chunk_count = 0
    for doc_rowid, name in pending:
        row = con.execute(
            "SELECT description, body FROM documents WHERE rowid = ?", (doc_rowid,)
        ).fetchone()
        texts = chunk_body(row[0], row[1])
        if not texts:
            continue
        vectors = embed_texts(cfg.embedding, texts)
        with con:
            replace_doc_chunks(con, doc_rowid, texts, vectors)
        doc_count += 1
        chunk_count += len(texts)
    return doc_count, chunk_count
