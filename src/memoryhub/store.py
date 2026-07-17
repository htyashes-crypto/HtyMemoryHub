"""SQLite 存取层:documents + FTS5(jieba 预分词)+ meta,schema 版本化迁移。

中文经 jieba 预分词为空格串再入 FTS5(unicode61 会把连续 CJK 当单 token,必须预分词);
documents.rowid 与 fts.rowid 一一对应。库是记忆文件的派生物,可随时删除重建。
"""

from __future__ import annotations

import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path

import jieba

from .scanner import MemoryDoc

# 每个元素 = 一个版本的建表语句组;user_version 记录已应用到的版本号
MIGRATIONS: list[list[str]] = [
    [  # v1: documents + fts + meta(Step 2 关键词闭环)
        """CREATE TABLE documents(
            rowid INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            rel_path TEXT NOT NULL,
            grp TEXT NOT NULL,
            display_name TEXT NOT NULL,
            description TEXT NOT NULL,
            mtype TEXT NOT NULL,
            body TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            mtime REAL NOT NULL
        )""",
        "CREATE VIRTUAL TABLE fts USING fts5(name, display_seg, desc_seg, body_seg)",
        "CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    ],
    [  # v2: 向量层块元表(Step 3;vec0 虚表因维度依赖配置而动态建,见 ensure_vec_table)
        """CREATE TABLE chunks(
            chunk_rowid INTEGER PRIMARY KEY,
            doc_rowid INTEGER NOT NULL,
            seq INTEGER NOT NULL,
            text TEXT NOT NULL
        )""",
        "CREATE INDEX idx_chunks_doc ON chunks(doc_rowid)",
    ],
]

META_FINGERPRINT = "embed_fingerprint"  # base_url|model|dim,不匹配拒绝增量


def load_vec_extension(con: sqlite3.Connection) -> None:
    import sqlite_vec

    con.enable_load_extension(True)
    sqlite_vec.load(con)
    con.enable_load_extension(False)


def vec_table_exists(con: sqlite3.Connection) -> bool:
    return con.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='vec_chunks'"
    ).fetchone() is not None


def ensure_vec_table(con: sqlite3.Connection, dim: int) -> None:
    con.execute(f"CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(embedding float[{dim}])")


def purge_vector_layer(con: sqlite3.Connection) -> None:
    """清空全部块与向量(换模型/维度后 reindex --force 用)。"""
    con.execute("DELETE FROM chunks")
    if vec_table_exists(con):
        con.execute("DROP TABLE vec_chunks")  # 维度可能已变,整表重建


def _delete_doc_chunks(con: sqlite3.Connection, doc_rowid: int) -> None:
    if vec_table_exists(con):
        con.execute(
            "DELETE FROM vec_chunks WHERE rowid IN "
            "(SELECT chunk_rowid FROM chunks WHERE doc_rowid = ?)", (doc_rowid,))
    con.execute("DELETE FROM chunks WHERE doc_rowid = ?", (doc_rowid,))


def replace_doc_chunks(con: sqlite3.Connection, doc_rowid: int,
                       texts: list[str], vectors: list[list[float]]) -> None:
    from sqlite_vec import serialize_float32

    _delete_doc_chunks(con, doc_rowid)
    for seq, (text, vec) in enumerate(zip(texts, vectors)):
        cur = con.execute(
            "INSERT INTO chunks(doc_rowid, seq, text) VALUES(?,?,?)",
            (doc_rowid, seq, text))
        con.execute(
            "INSERT INTO vec_chunks(rowid, embedding) VALUES(?,?)",
            (cur.lastrowid, serialize_float32(vec)))


def docs_missing_chunks(con: sqlite3.Connection) -> list[tuple[int, str]]:
    """待嵌入的文档(新增/内容变更后块被级联清除的):(doc_rowid, name)。"""
    return con.execute(
        "SELECT d.rowid, d.name FROM documents d WHERE NOT EXISTS "
        "(SELECT 1 FROM chunks c WHERE c.doc_rowid = d.rowid) ORDER BY d.name"
    ).fetchall()


def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    load_vec_extension(con)  # 统一加载:凡触及 vec_chunks 虚表的 SQL 都依赖 vec0 模块
    con.execute("PRAGMA journal_mode=WAL")
    ver = con.execute("PRAGMA user_version").fetchone()[0]
    for i in range(ver, len(MIGRATIONS)):
        with con:
            for sql in MIGRATIONS[i]:
                con.execute(sql)
            con.execute(f"PRAGMA user_version = {i + 1}")
    return con


def _seg(text: str) -> str:
    """jieba 搜索引擎模式分词 → 空格串(FTS5 入库/查询共用同一切分)。"""
    return " ".join(t for t in jieba.cut_for_search(text) if t.strip())


def upsert_doc(con: sqlite3.Connection, doc: MemoryDoc) -> None:
    row = con.execute("SELECT rowid FROM documents WHERE name = ?", (doc.name,)).fetchone()
    cols = (doc.rel_path, doc.group, doc.display_name, doc.description,
            doc.mtype, doc.body, doc.content_hash, doc.mtime)
    if row:
        rowid = row[0]
        con.execute(
            """UPDATE documents SET rel_path=?, grp=?, display_name=?, description=?,
               mtype=?, body=?, content_hash=?, mtime=? WHERE rowid=?""",
            (*cols, rowid),
        )
        con.execute("DELETE FROM fts WHERE rowid = ?", (rowid,))
        _delete_doc_chunks(con, rowid)  # 内容已变,旧块/旧向量必失效 → 进"待嵌入"态
    else:
        cur = con.execute(
            """INSERT INTO documents(name, rel_path, grp, display_name, description,
               mtype, body, content_hash, mtime) VALUES(?,?,?,?,?,?,?,?,?)""",
            (doc.name, *cols),
        )
        rowid = cur.lastrowid
    con.execute(
        "INSERT INTO fts(rowid, name, display_seg, desc_seg, body_seg) VALUES(?,?,?,?,?)",
        (rowid, doc.name, _seg(doc.display_name), _seg(doc.description), _seg(doc.body)),
    )


def remove_doc(con: sqlite3.Connection, name: str) -> None:
    row = con.execute("SELECT rowid FROM documents WHERE name = ?", (name,)).fetchone()
    if row:
        con.execute("DELETE FROM fts WHERE rowid = ?", (row[0],))
        _delete_doc_chunks(con, row[0])
        con.execute("DELETE FROM documents WHERE rowid = ?", (row[0],))


def current_hashes(con: sqlite3.Connection) -> dict[str, str]:
    return dict(con.execute("SELECT name, content_hash FROM documents").fetchall())


def set_meta(con: sqlite3.Connection, key: str, value: str) -> None:
    con.execute(
        "INSERT INTO meta(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )


def get_meta(con: sqlite3.Connection, key: str) -> str | None:
    row = con.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
    return row[0] if row else None


@dataclass
class SearchHit:
    name: str
    rel_path: str
    group: str
    display_name: str
    description: str
    mtype: str
    score: float
    snippet: str


# 分词版 snippet 里 CJK 字符间的空格是切词痕迹,压缩掉恢复可读性(英文间空格保留)
_CJK = "一-鿿　-〿＀-￯«»"
_CJK_GAP_RE = re.compile(f"(?<=[{_CJK}]) (?=[{_CJK}])")


def _fts_query(query: str) -> str:
    """query 经同一套 jieba 切分,token 加引号防 FTS5 语法字符,OR 连接靠 bm25 排序。"""
    tokens = [t.strip().replace('"', '""') for t in jieba.cut_for_search(query)]
    return " OR ".join(f'"{t}"' for t in tokens if t)


def search_keyword(
    con: sqlite3.Connection,
    query: str,
    top_k: int = 8,
    group: str | None = None,
    mtype: str | None = None,
) -> list[SearchHit]:
    match = _fts_query(query)
    if not match:
        return []
    sql = (
        "SELECT d.name, d.rel_path, d.grp, d.display_name, d.description, d.mtype, "
        "       bm25(fts, 8.0, 6.0, 4.0, 1.0) AS score, "
        "       snippet(fts, 3, '«', '»', '…', 16) AS snip "
        "FROM fts JOIN documents d ON d.rowid = fts.rowid "
        "WHERE fts MATCH ?"
    )
    args: list = [match]
    if group:
        sql += " AND d.grp = ?"
        args.append(group)
    if mtype:
        sql += " AND d.mtype = ?"
        args.append(mtype)
    sql += " ORDER BY score LIMIT ?"
    args.append(top_k)
    hits = []
    for name, rel, grp, disp, desc, mt, score, snip in con.execute(sql, args):
        hits.append(SearchHit(
            name=name, rel_path=rel, group=grp, display_name=disp, description=desc,
            mtype=mt, score=-float(score), snippet=_CJK_GAP_RE.sub("", snip),
        ))
    return hits  # score 取负:bm25 越小越相关 → 对外统一"越大越相关"


def doc_body(con: sqlite3.Connection, name: str) -> tuple[str, str] | None:
    """按主键取全文,返回 (rel_path, body);不存在返回 None。"""
    row = con.execute(
        "SELECT rel_path, body FROM documents WHERE name = ?", (name,)
    ).fetchone()
    return (row[0], row[1]) if row else None

