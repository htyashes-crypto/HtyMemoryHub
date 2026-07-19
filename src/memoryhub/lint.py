"""一致性校验两级:硬规则(违规必须处理)+ 嫌疑清单(语义级,供 AI 审计会话消化)。

用户只看架构层——细节层的格式/引用合规由硬规则机器兜住;机器只能标"嫌疑"
不能裁决的(重复/放错组)进 suspects,实时计算幂等(审计修正后重跑自然消失)。
"""

from __future__ import annotations

import struct
from math import sqrt

from .config import InstanceConfig
from .scanner import scan
from .store import connect
from .writer import claude_cache_root


def _cos(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sqrt(sum(x * x for x in a)) or 1.0
    nb = sqrt(sum(x * x for x in b)) or 1.0
    return dot / (na * nb)


def _first_chunk_vectors(con) -> dict[str, list[float]]:
    """每文档首块向量(doc name → vec);无向量层返回空。"""
    from .store import vec_table_exists

    if not vec_table_exists(con):
        return {}
    out: dict[str, list[float]] = {}
    for name, blob in con.execute(
        "SELECT d.name, v.embedding FROM documents d "
        "JOIN chunks c ON c.doc_rowid = d.rowid AND c.seq = 0 "
        "JOIN vec_chunks v ON v.rowid = c.chunk_rowid"
    ):
        out[name] = list(struct.unpack(f"{len(blob) // 4}f", blob))
    return out


def run_lint(cfg: InstanceConfig) -> dict:
    from .arch import collect

    docs = scan(cfg.memory_root)
    names = {d.name for d in docs}
    hard: list[str] = []
    suspects: list[dict] = []

    # 硬 1:架构围栏(R1~R8)
    _, arch_errors = collect(docs)
    hard.extend(arch_errors)

    # 硬 2:双写对账(权威 vs Claude 缓存,逐文件内容一致;
    # 权威 MEMORY.md 头部的 <!--⚖️ 契约--> 注释块是设计内单侧差异,剥离后再比,同 verify.ps1 口径)
    import re

    def _strip_contract(text: str) -> str:
        return re.sub(r"\A<!--.*?-->\s*", "", text, flags=re.DOTALL)

    cache_root = claude_cache_root(cfg.workspace)
    if cache_root is None or not cache_root.is_dir():
        suspects.append({"kind": "cache-missing", "subject": str(cache_root),
                         "detail": "本机无 Claude 产品缓存目录,双写对账跳过"})
    else:
        cache_files = {p.relative_to(cache_root).as_posix(): p
                       for p in cache_root.rglob("*.md")}
        for d in docs:
            cp = cache_files.pop(d.rel_path, None)
            if cp is None:
                hard.append(f"[双写] 缓存缺失: {d.rel_path}")
            elif _strip_contract(cp.read_text(encoding="utf-8", errors="replace")) != _strip_contract(
                    (cfg.memory_root / d.rel_path).read_text(encoding="utf-8", errors="replace")):
                hard.append(f"[双写] 内容不一致: {d.rel_path}")
        for rel in cache_files:
            hard.append(f"[双写] 缓存多出(权威已删未同步): {rel}")

    # 警告 1:断 [[链]](修复候选)
    for d in docs:
        for dst in d.wikilinks:
            if dst not in names:
                suspects.append({"kind": "broken-link", "subject": d.name,
                                 "detail": f"[[{dst}]] 目标不存在"})

    # 警告 2:frontmatter 薄弱(索引/模块文件除外)
    for d in docs:
        if d.name.startswith(("index_", "MEMORY", "module_")):
            continue
        if not d.description or not d.mtype:
            suspects.append({"kind": "weak-frontmatter", "subject": d.name,
                             "detail": f"缺 {'description ' if not d.description else ''}{'type' if not d.mtype else ''}".strip()})

    # 警告 3:封面对账(set 组走分级封面链:组内全部 index_* 封面拼接后查,任一层登记即算)
    covers: dict[str, str] = {}
    for d in docs:
        if d.group and d.name.startswith("index_"):
            covers[d.group] = covers.get(d.group, "") + "\n" + d.body
    for d in docs:
        if d.group and not d.name.startswith(("index_", "module_")):
            cover = covers.get(d.group)
            if cover is not None and d.name not in cover:
                suspects.append({"kind": "cover-unlisted", "subject": d.name,
                                 "detail": f"组内各级封面(index_*,{d.group})均未登记"})

    # 警告 4/5:重复嫌疑 + 分类漂移(需向量层)
    con = connect(cfg.db_path)
    try:
        vecs = _first_chunk_vectors(con)
    finally:
        con.close()
    if vecs:
        # 组质心 → 漂移(与本组质心余弦相似显著低)
        groups: dict[str, list[str]] = {}
        for d in docs:
            if d.name in vecs and d.group and not d.name.startswith(("index_", "module_")):
                groups.setdefault(d.group, []).append(d.name)
        for grp, members in groups.items():
            if len(members) < 5:
                continue
            dim = len(vecs[members[0]])
            centroid = [sum(vecs[m][i] for m in members) / len(members) for i in range(dim)]
            for m in members:
                sim = _cos(vecs[m], centroid)
                if sim < 0.30:
                    suspects.append({"kind": "group-drift", "subject": m,
                                     "detail": f"与组 {grp} 质心相似度 {sim:.2f}(疑放错组)"})
        # 重复对(两两余弦 > 0.92;383 文档纯 python 可承受,实时幂等)
        items = sorted(vecs.items())
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                sim = _cos(items[i][1], items[j][1])
                if sim > 0.92:
                    suspects.append({"kind": "dup-suspect",
                                     "subject": f"{items[i][0]} ↔ {items[j][0]}",
                                     "detail": f"首块向量相似 {sim:.2f}(疑重复,候选合并)"})
    return {
        "docs": len(docs),
        "vectorCoverage": len(vecs),  # 0 = 向量层未就绪,dup/drift 两类未评估(非"零嫌疑")
        "hard": hard,
        "suspects": suspects,
        "ok": not hard,
    }
