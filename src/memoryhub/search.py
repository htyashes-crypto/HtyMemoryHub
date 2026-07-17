"""检索编排:keyword / vector / hybrid(RRF 融合)三模式统一入口。

CLI 与服务端(MCP/REST)共用本模块——双端一致原则:同 query 必同结果。
"""

from __future__ import annotations

import sqlite3

from .config import InstanceConfig
from .store import SearchHit, search_keyword, search_vector

_RRF_K = 60          # RRF 平滑常数(信息检索标准取值)
_CANDIDATES = 30     # 融合前每路候选数


def _embed_query(cfg: InstanceConfig, query: str) -> list[float]:
    from .embedder import embed_texts

    assert cfg.embedding is not None  # cli/服务层已拦"未配置"
    return embed_texts(cfg.embedding, [query])[0]


def _rrf_merge(ranked_lists: list[list[SearchHit]], top_k: int) -> list[SearchHit]:
    """RRF:score(doc) = Σ 1/(K+rank);首见列表提供展示字段(keyword 在前保高亮 snippet)。"""
    scores: dict[str, float] = {}
    best: dict[str, SearchHit] = {}
    for hits in ranked_lists:
        for rank, h in enumerate(hits):
            scores[h.name] = scores.get(h.name, 0.0) + 1.0 / (_RRF_K + rank + 1)
            cur = best.get(h.name)
            if cur is None or (not cur.snippet and h.snippet):
                best[h.name] = h
    merged = sorted(best.values(), key=lambda h: scores[h.name], reverse=True)[:top_k]
    return [
        SearchHit(
            name=h.name, rel_path=h.rel_path, group=h.group,
            display_name=h.display_name, description=h.description, mtype=h.mtype,
            score=scores[h.name], snippet=h.snippet,
        )
        for h in merged
    ]


def run_search(
    con: sqlite3.Connection,
    cfg: InstanceConfig,
    query: str,
    mode: str = "hybrid",
    top_k: int = 8,
    group: str | None = None,
    mtype: str | None = None,
) -> list[SearchHit]:
    if mode == "keyword":
        return search_keyword(con, query, top_k=top_k, group=group, mtype=mtype)
    if mode == "vector":
        return search_vector(con, _embed_query(cfg, query), top_k=top_k, group=group, mtype=mtype)
    if mode == "hybrid":
        kw = search_keyword(con, query, top_k=_CANDIDATES, group=group, mtype=mtype)
        vec = search_vector(con, _embed_query(cfg, query), top_k=_CANDIDATES, group=group, mtype=mtype)
        return _rrf_merge([kw, vec], top_k)
    raise SystemExit(f"未知 mode: {mode}(可选 hybrid / vector / keyword)")
