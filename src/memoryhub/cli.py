"""MemoryHub 命令行入口(typer)。"""

from __future__ import annotations

import sqlite3
import sys

import typer

from .config import ENV_API_KEY, api_key, load_config

app = typer.Typer(
    name="memoryhub",
    help="工作区记忆库检索服务:混合检索 / MCP / REST / CLI。",
    no_args_is_help=True,
    add_completion=False,
)

WorkspaceOpt = typer.Option(None, "--workspace", "-w", help="工作区根目录(缺省从当前目录向上找 .htyworkflows)")


@app.callback()
def _root() -> None:
    """保持子命令模式(typer 对单命令 app 会折叠为主命令,导致 `memoryhub status` 解析失败)。"""


def _check_fts5() -> str:
    try:
        with sqlite3.connect(":memory:") as db:
            db.execute("CREATE VIRTUAL TABLE t USING fts5(x)")
        return "✓"
    except sqlite3.OperationalError as exc:  # FTS5 未编译进 sqlite
        return f"✗ ({exc})"


def _check_sqlite_vec() -> str:
    try:
        import sqlite_vec

        db = sqlite3.connect(":memory:")
        db.enable_load_extension(True)
        sqlite_vec.load(db)
        ver = db.execute("SELECT vec_version()").fetchone()[0]
        db.close()
        return f"✓ {ver}"
    except Exception as exc:  # 扩展加载失败属环境问题,如实报出
        return f"✗ ({exc})"


def _check_jieba() -> str:
    try:
        import jieba  # noqa: F401

        return "✓"
    except Exception as exc:
        return f"✗ ({exc})"


@app.command()
def status(workspace: str = WorkspaceOpt) -> None:
    """打印实例配置与环境自检结果。"""
    cfg = load_config(workspace)
    typer.echo(f"工作区:   {cfg.workspace}")
    if cfg.config_path.is_file():
        typer.echo(f"配置:     {cfg.config_path}")
    else:
        typer.echo(f"配置:     {cfg.config_path} (缺失 → 待 memoryhub init)")
    typer.echo(f"端口:     {cfg.port}")
    if cfg.memory_root.is_dir():
        md_count = sum(1 for _ in cfg.memory_root.rglob("*.md"))
        typer.echo(f"memory:   {cfg.memory_root} ({md_count} 个 .md)")
    else:
        typer.echo(f"memory:   {cfg.memory_root} (目录不存在!)")
    if cfg.embedding:
        e = cfg.embedding
        typer.echo(f"embedding: {e.model} @ {e.base_url} (dim {e.dim})")
    else:
        typer.echo("embedding: 未配置(向量/hybrid 不可用,keyword 可用)")
    typer.echo(f"API key:  {ENV_API_KEY} {'已设置' if api_key() else '未设置'}")
    typer.echo(
        f"自检:     sqlite {sqlite3.sqlite_version} · FTS5 {_check_fts5()}"
        f" · sqlite-vec {_check_sqlite_vec()} · jieba {_check_jieba()}"
    )


@app.command()
def reindex(
    workspace: str = WorkspaceOpt,
    keyword_only: bool = typer.Option(False, "--keyword-only", help="只重建关键词层(不调 embedding API)"),
    force: bool = typer.Option(False, "--force", help="清空向量层全量重嵌(换 embedding 模型/维度后用)"),
) -> None:
    """全量对账式重建索引(hash 未变的文件跳过;向量层只嵌"缺块"文档)。"""
    from .indexer import reindex_keyword, reindex_vectors
    from .store import connect

    cfg = load_config(workspace)
    if not keyword_only and cfg.embedding is None:
        raise SystemExit("embedding 未配置(先跑 memoryhub init);当前可用 --keyword-only 只建关键词层")
    con = connect(cfg.db_path)
    stats = reindex_keyword(con, cfg)
    typer.echo(f"关键词层:{stats.summary()}")
    if not keyword_only:
        docs, chunks = reindex_vectors(con, cfg, force=force)
        typer.echo(f"向量层:  嵌入 {docs} docs / {chunks} chunks")
    con.close()


@app.command()
def search(
    query: str,
    workspace: str = WorkspaceOpt,
    mode: str = typer.Option("hybrid", "--mode", "-m", help="hybrid / vector / keyword"),
    top_k: int = typer.Option(8, "--top-k", "-k"),
    group: str = typer.Option(None, "--group", help="按组过滤,如 index_1_set_network"),
    mtype: str = typer.Option(None, "--type", help="按类型过滤:feedback/project/reference/user"),
) -> None:
    """检索记忆:关键词(FTS5+jieba)/ 语义(向量)/ 混合(RRF 融合)。"""
    from .search import run_search
    from .store import connect

    cfg = load_config(workspace)
    if mode in ("hybrid", "vector") and cfg.embedding is None:
        raise SystemExit(f"mode={mode} 需要 embedding(先跑 memoryhub init);无网络/未配置时可用 -m keyword")
    con = connect(cfg.db_path)
    hits = run_search(con, cfg, query, mode=mode, top_k=top_k, group=group, mtype=mtype)
    if not hits:
        typer.echo("(无结果)")
    for i, h in enumerate(hits, 1):
        typer.echo(f"{i}. {h.name}  [{h.group or '根'}·{h.mtype or '-'}]  {h.score:.2f}")
        if h.display_name != h.name:
            typer.echo(f"   {h.display_name}")
        if h.description:
            typer.echo(f"   {h.description[:80]}")
        typer.echo(f"   {h.snippet}")
    con.close()


@app.command()
def get(
    name: str,
    workspace: str = WorkspaceOpt,
) -> None:
    """按主键(文件 basename)输出记忆全文。"""
    from .store import connect, doc_body

    cfg = load_config(workspace)
    con = connect(cfg.db_path)
    found = doc_body(con, name)
    con.close()
    if found is None:
        raise SystemExit(f"记忆不存在: {name}")
    rel, body = found
    typer.echo(f"# {name}  ({rel})\n")
    typer.echo(body)


@app.command()
def serve(workspace: str = WorkspaceOpt) -> None:
    """启动常驻服务:MCP(/mcp)+ REST,绑定 127.0.0.1:<port>。"""
    import uvicorn

    from .indexer import reindex_keyword, reindex_vectors
    from .server import create_app
    from .store import connect

    cfg = load_config(workspace)
    # 启动对账:覆盖服务停机期间的文件变更(增量,hash 未变即零成本)
    con = connect(cfg.db_path)
    stats = reindex_keyword(con, cfg)
    typer.echo(f"启动对账(关键词层):{stats.summary()}")
    if cfg.embedding is not None:
        try:
            docs, chunks = reindex_vectors(con, cfg)
            typer.echo(f"启动对账(向量层):嵌入 {docs} docs / {chunks} chunks")
        except SystemExit as exc:  # 网络/指纹问题:警告后照常起服务,vector 查询时仍会明确报错
            typer.echo(f"⚠ 向量层对账失败(keyword 仍可用): {exc}", err=True)
    con.close()
    typer.echo(f"MCP:  http://127.0.0.1:{cfg.port}/mcp")
    typer.echo(f"REST: http://127.0.0.1:{cfg.port}/search /doc/{{name}} /stats /healthz /reindex")
    uvicorn.run(create_app(cfg), host="127.0.0.1", port=cfg.port, log_level="warning")


def main() -> None:
    # Windows 控制台默认 GBK,无法编码 ✓/· 等符号;统一 UTF-8 输出(一次解决所有命令)
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    app()
