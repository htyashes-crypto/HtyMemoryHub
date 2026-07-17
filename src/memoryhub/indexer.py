"""索引编排:全量/增量 reindex(scan → hash 差集 → store 更新)。

watchdog 目录监控在 Step 6 并入本模块。
"""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone

from .config import InstanceConfig
from .scanner import scan
from .store import current_hashes, remove_doc, set_meta, upsert_doc


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
