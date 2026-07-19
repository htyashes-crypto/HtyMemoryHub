"""常驻服务:FastMCP(streamable-http,/mcp)+ REST 路由,单 uvicorn 进程。

MCP 工具与 REST 端点都经 search.run_search / store 同一数据路径(双端一致)。
SQLite 每请求短连接(WAL 并发读安全,免跨线程连接问题);服务绑 127.0.0.1。
"""

from __future__ import annotations

from contextlib import closing

from mcp.server.fastmcp import FastMCP

from .config import InstanceConfig
from .search import run_search
from .store import SearchHit, connect, doc_body, get_meta

_cfg: InstanceConfig | None = None  # serve 启动时注入(进程级单实例)


def _config() -> InstanceConfig:
    assert _cfg is not None, "server 未初始化:必须经 create_app(cfg) 启动"
    return _cfg


def _hit_dict(h: SearchHit, body: str | None = None) -> dict:
    d = {
        "name": h.name, "path": h.rel_path, "group": h.group, "type": h.mtype,
        "displayName": h.display_name, "description": h.description,
        "score": round(h.score, 4), "snippet": h.snippet,
    }
    if body is not None:
        d["body"] = body
    return d


def _do_search(query: str, mode: str, top_k: int, group: str | None,
               mtype: str | None, include_body: bool) -> dict:
    cfg = _config()
    if mode in ("hybrid", "vector") and cfg.embedding is None:
        raise ValueError(f"mode={mode} 需要 embedding 配置;未配置时请用 mode=keyword")
    with closing(connect(cfg.db_path)) as con:
        hits = run_search(con, cfg, query, mode=mode, top_k=top_k, group=group, mtype=mtype)
        results = []
        for h in hits:
            body = doc_body(con, h.name)[1] if include_body else None
            results.append(_hit_dict(h, body))
        last = get_meta(con, "last_indexed")
    return {"query": query, "mode": mode, "lastIndexed": last, "results": results}


def _do_get(names: list[str]) -> dict:
    cfg = _config()
    found, missing = [], []
    with closing(connect(cfg.db_path)) as con:
        for name in names:
            row = doc_body(con, name)
            if row is None:
                missing.append(name)
            else:
                found.append({"name": name, "path": row[0], "body": row[1]})
    return {"found": found, "missing": missing}


def _do_stats() -> dict:
    cfg = _config()
    with closing(connect(cfg.db_path)) as con:
        docs = con.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        chunks = con.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        last = get_meta(con, "last_indexed")
        fp = get_meta(con, "embed_fingerprint")
    emb = cfg.embedding
    return {
        "workspace": str(cfg.workspace),
        "memoryRoot": str(cfg.memory_root),
        "port": cfg.port,
        "docs": docs,
        "chunks": chunks,
        "lastIndexed": last,
        "embedding": {"baseUrl": emb.base_url, "model": emb.model, "dim": emb.dim} if emb else None,
        "fingerprint": fp,
    }


# ---------------- MCP 工具 ----------------

mcp = FastMCP("memoryhub")  # 标准有状态 streamable-http(SDK 客户端按 mcp-session-id 走会话流程)


@mcp.tool()
def memory_search(query: str, mode: str = "hybrid", top_k: int = 8,
                  group: str | None = None, mtype: str | None = None,
                  include_body: bool = False) -> dict:
    """检索工作区记忆库(关键词或自然语句)。mode: hybrid(默认)/vector/keyword——
    代号/ID 类精确查询(如 BUG-105、类名、GUID)建议 mode=keyword(向量对代号语义弱,
    hybrid 会被稀释);group 按组过滤(如 index_1_set_network);mtype 按类型过滤
    (feedback/project/...);默认返回摘要与命中片段,include_body=True 附全文。"""
    return _do_search(query, mode, top_k, group, mtype, include_body)


@mcp.tool()
def memory_get(names: list[str]) -> dict:
    """按主键(文件 basename,如 feedback_rootcause_fix)批量取记忆全文。"""
    return _do_get(names)


@mcp.tool()
def memory_stats() -> dict:
    """索引状态:文档/块数、最后索引时间、embedding 模型指纹、工作区路径。"""
    return _do_stats()


# ---------------- REST + 应用组装 ----------------

def create_app(cfg: InstanceConfig):
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    from starlette.routing import Route

    global _cfg
    _cfg = cfg

    def _err(exc: Exception, status: int = 400) -> JSONResponse:
        return JSONResponse({"error": str(exc)}, status_code=status)

    async def healthz(_: Request) -> JSONResponse:
        return JSONResponse({"ok": True})

    async def stats(_: Request) -> JSONResponse:
        return JSONResponse(_do_stats())

    async def search(req: Request) -> JSONResponse:
        q = req.query_params.get("q", "").strip()
        if not q:
            return _err(ValueError("缺少查询参数 q"))
        try:
            return JSONResponse(_do_search(
                q,
                req.query_params.get("mode", "hybrid"),
                int(req.query_params.get("top_k", "8")),
                req.query_params.get("group") or None,
                req.query_params.get("type") or None,
                req.query_params.get("include_body") == "true",
            ))
        except (ValueError, SystemExit) as exc:
            return _err(exc)

    async def doc(req: Request) -> JSONResponse:
        result = _do_get([req.path_params["name"]])
        if result["missing"]:
            return _err(KeyError(f"记忆不存在: {req.path_params['name']}"), 404)
        return JSONResponse(result["found"][0])

    async def reindex(req: Request) -> JSONResponse:
        from .indexer import reindex_keyword, reindex_vectors

        keyword_only = req.query_params.get("keyword_only") == "true"
        force = req.query_params.get("force") == "true"
        if not keyword_only and cfg.embedding is None:
            return _err(ValueError("embedding 未配置;可加 ?keyword_only=true 只建关键词层"))
        with closing(connect(cfg.db_path)) as con:
            stats_kw = reindex_keyword(con, cfg)
            payload: dict = {"keyword": stats_kw.summary()}
            if not keyword_only:
                try:
                    docs, chunks = reindex_vectors(con, cfg, force=force)
                    payload["vector"] = f"嵌入 {docs} docs / {chunks} chunks"
                except SystemExit as exc:
                    return _err(exc, 409)  # 指纹不符等,如实回传
        return JSONResponse(payload)

    app = mcp.streamable_http_app()  # MCP 端点挂 /mcp
    for route in (
        Route("/healthz", healthz),
        Route("/stats", stats),
        Route("/search", search),
        Route("/doc/{name}", doc),
        Route("/reindex", reindex, methods=["POST"]),
    ):
        app.router.routes.append(route)

    if cfg.auth_token:  # 非空才启用 Bearer 校验(留空=127.0.0.1 本机免鉴权)
        from starlette.middleware.base import BaseHTTPMiddleware

        class _Auth(BaseHTTPMiddleware):
            async def dispatch(self, request, call_next):
                if request.url.path != "/healthz" and \
                        request.headers.get("Authorization") != f"Bearer {cfg.auth_token}":
                    return JSONResponse({"error": "unauthorized"}, status_code=401)
                return await call_next(request)

        app.add_middleware(_Auth)
    return app
