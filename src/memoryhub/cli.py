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


def main() -> None:
    # Windows 控制台默认 GBK,无法编码 ✓/· 等符号;统一 UTF-8 输出(一次解决所有命令)
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    app()
