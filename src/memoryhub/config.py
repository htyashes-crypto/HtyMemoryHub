"""工作区实例配置:定位、加载、写入。

工程 / 实例分离:代码在 HtyMemoryHub 工程,每个使用方工作区持有
`<工作区>/.htyworkflows/memoryhub/config.json`(实例配置)与 `db/`(索引库,派生物)。
API key 只走环境变量,不落任何文件。
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

ENV_API_KEY = "MEMORYHUB_EMBED_API_KEY"
INSTANCE_DIR = ".htyworkflows/memoryhub"
CONFIG_NAME = "config.json"
DEFAULT_PORT = 61397
DEFAULT_MEMORY_ROOT = ".htyworkflows/memory"


@dataclass
class EmbeddingConfig:
    base_url: str
    model: str
    dim: int


@dataclass
class InstanceConfig:
    workspace: Path
    port: int
    memory_root_rel: str
    embedding: EmbeddingConfig | None  # None = 未 init,向量能力不可用
    auth_token: str = ""               # 非空则服务端校验 Bearer(留空=本机免鉴权)

    @property
    def instance_dir(self) -> Path:
        return self.workspace / INSTANCE_DIR

    @property
    def config_path(self) -> Path:
        return self.instance_dir / CONFIG_NAME

    @property
    def db_path(self) -> Path:
        return self.instance_dir / "db" / "memory.db"

    @property
    def memory_root(self) -> Path:
        return self.workspace / self.memory_root_rel


def resolve_workspace(workspace: str | None) -> Path:
    """定位工作区根:显式 --workspace 优先;否则从 cwd 向上找含 .htyworkflows 的目录。"""
    if workspace:
        root = Path(workspace).resolve()
        if not (root / ".htyworkflows").is_dir():
            raise SystemExit(f"指定的工作区没有 .htyworkflows 目录: {root}")
        return root
    cur = Path.cwd().resolve()
    for cand in (cur, *cur.parents):
        if (cand / ".htyworkflows").is_dir():
            return cand
    raise SystemExit("未找到工作区(当前目录向上均无 .htyworkflows);请用 --workspace 指定工作区根")


def load_config(workspace: str | None) -> InstanceConfig:
    """读实例 config.json;缺失时返回默认值(embedding=None 的未初始化态)。"""
    root = resolve_workspace(workspace)
    cfg_path = root / INSTANCE_DIR / CONFIG_NAME
    if not cfg_path.is_file():
        return InstanceConfig(root, DEFAULT_PORT, DEFAULT_MEMORY_ROOT, None)
    data = json.loads(cfg_path.read_text(encoding="utf-8"))
    emb = None
    if isinstance(data.get("embedding"), dict):
        e = data["embedding"]
        emb = EmbeddingConfig(base_url=e["baseUrl"], model=e["model"], dim=int(e["dim"]))
    return InstanceConfig(
        workspace=root,
        port=int(data.get("port", DEFAULT_PORT)),
        memory_root_rel=data.get("memoryRoot", DEFAULT_MEMORY_ROOT),
        embedding=emb,
        auth_token=str(data.get("authToken", "")),
    )


def write_config(cfg: InstanceConfig) -> None:
    """把实例配置写回工作区(init 与配置变更共用;不含 key)。"""
    data: dict = {"port": cfg.port, "memoryRoot": cfg.memory_root_rel}
    if cfg.auth_token:
        data["authToken"] = cfg.auth_token
    if cfg.embedding is not None:
        data["embedding"] = {
            "baseUrl": cfg.embedding.base_url,
            "model": cfg.embedding.model,
            "dim": cfg.embedding.dim,
        }
    cfg.instance_dir.mkdir(parents=True, exist_ok=True)
    cfg.config_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def api_key() -> str | None:
    return os.environ.get(ENV_API_KEY) or None


# ---- 机器级端口登记(port ↔ workspace):多工作区实例的配置层隔离 ----
# 只看"运行时占用"分配端口有竞态:B onboard 时 A 服务恰好没跑,两工作区会分到
# 同端口→后启动方 bind 失败或会话静默连错库。登记表使分配与归属在配置层唯一。

_PORTS_PATH = Path.home() / ".memoryhub" / "ports.json"


def load_port_registry() -> dict[str, str]:
    if not _PORTS_PATH.is_file():
        return {}
    return json.loads(_PORTS_PATH.read_text(encoding="utf-8"))


def register_port(port: int, workspace: Path) -> None:
    """登记端口归属;同工作区旧端口条目一并清理(改端口后不留幽灵占位)。"""
    reg = load_port_registry()
    ws = str(workspace)
    reg = {p: w for p, w in reg.items() if w != ws}
    reg[str(port)] = ws
    _PORTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    _PORTS_PATH.write_text(json.dumps(reg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def port_owner(port: int) -> str | None:
    return load_port_registry().get(str(port))
