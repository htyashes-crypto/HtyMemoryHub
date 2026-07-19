# HtyMemoryHub

工作区记忆库检索服务:云 embedding(任意 OpenAI-compatible 供应商)+ SQLite FTS5 中文关键词的**混合检索**,以 **MCP(streamable-http)/ REST / CLI** 三入口服务外部工具(Claude Code / Codex / 脚本)。

**工程 / 实例分离**:本仓库只有代码;每个使用方工作区持有自己的实例数据 `<工作区>/.htyworkflows/memoryhub/`(config.json + db,库是记忆 md 文件的派生物,可随时重建)。一份部署可服务多个工作区(各起一实例、端口错开)。

## 新工作区一键接入(推荐)

```powershell
uv run memoryhub onboard <工作区根>
```

一条命令完成:记忆库种子(目录不存在则建 `.htyworkflows/memory/MEMORY.md`)→ 自动挑空闲端口(61397 起,多工作区并存不冲突)→ 自动探测本机 Ollama(无则交互填任意 OpenAI-compatible 供应商)→ 建全量索引 → 注册工作区 `.mcp.json`。之后 `serve -w <工作区>` 即用。可选参数:`--port` / `--base-url` / `--model` 显式指定。

## 新电脑首次部署(五步)

```powershell
# 1. 取代码 + 装依赖(需已装 uv;python 版本由 uv 自动管理)
git clone https://github.com/htyashes-crypto/HtyMemoryHub.git
cd HtyMemoryHub && uv sync

# 2. 配置 embedding key(供应商见下表;用户级持久化,新开终端生效)
[Environment]::SetEnvironmentVariable("MEMORYHUB_EMBED_API_KEY", "你的key", "User")

# 3. 初始化实例(交互引导供应商;或 --base-url/--model 非交互)
uv run memoryhub init -w <工作区根>

# 4. 建全量索引
uv run memoryhub reindex -w <工作区根>

# 5. 起服务(或双击 start-memoryhub.bat,快捷方式可带工作区参数)
uv run memoryhub serve -w <工作区根>
```

工作区要求:根下存在 `.htyworkflows/memory/`(记忆 md 库)。`-w` 缺省时从当前目录向上找 `.htyworkflows`。

## 供应商(任意 OpenAI-compatible 皆可,切换 = 重跑 init + reindex --force)

| 供应商 | base_url | model | 备注 |
|---|---|---|---|
| 阿里云百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `text-embedding-v4` | 国内直连,中文强,推荐 |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | `embedding-3` | 国内直连 |
| SiliconFlow | `https://api.siliconflow.cn/v1` | `BAAI/bge-m3` | 有免费档 |
| OpenAI | `https://api.openai.com/v1` | `text-embedding-3-small` | 需国际网络 |

## 接入 AI 工具(MCP)

工作区 `.mcp.json` 加:

```json
"memoryhub": { "type": "http", "url": "http://127.0.0.1:61397/mcp" }
```

MCP 工具:`memory_search`(关键词/语句,hybrid/vector/keyword)· `memory_get`(按 basename 取全文)· `memory_stats`。REST 同数据源:`GET /search?q=...&mode=...` `/doc/{name}` `/stats` `/healthz`,`POST /reindex`。

## 常用命令

```
memoryhub status    # 配置与环境自检(FTS5/sqlite-vec/jieba/key)
memoryhub search "联机 手牌 不同步" [-m keyword|vector|hybrid] [-k 8] [--group X] [--type feedback]
memoryhub get <记忆basename>
memoryhub reindex [--keyword-only] [--force]
memoryhub serve
```

## 机制要点

- **权威 = md 文件**,索引是派生物;服务内 watchdog 监控 memory 目录,.md 变更 2s 去抖自动增量(全量对账式,覆盖增/改/删/改名);serve 启动时先对账一次,覆盖停机期变更。
- **模型指纹守卫**:库记录 `base_url|model|dim`,配置变更后拒绝增量,须 `reindex --force` 清向量层重建——杜绝两种模型向量混库。
- **失败明确报错**:embedding API 不可用时 hybrid/vector 明确报错并提示 `-m keyword`(FTS5 无网可用);无静默降级。
- key 只走环境变量 `MEMORYHUB_EMBED_API_KEY`,不落盘;服务绑 127.0.0.1,config 可选 `authToken` 启用 Bearer 校验(留空=本机免鉴权)。

## 故障排查

| 症状 | 原因 / 处理 |
|---|---|
| `memoryhub status` 显示 FTS5/sqlite-vec ✗ | Python 构建缺组件:`uv python pin 3.12` 换版本重 `uv sync` |
| python httpx/MCP 测试客户端对 127.0.0.1 返回 **403(响应无 server: uvicorn 头)** | 本机**系统代理(注册表级)**拦截:httpx 读 Windows 注册表代理且不处理本地例外,请求被发给代理。服务端与 Claude Code(Node)不受影响;python 测试用 `httpx.Client(trust_env=False)` 或关系统代理 |
| 端口被占启动失败 | `init --port <新端口>` 换端口,并同步改工作区 `.mcp.json` 的 url |
| reindex 报"embedding 配置已变" | 换过供应商/模型:`reindex --force` 清向量层全量重嵌 |
| 检索结果陈旧 | 服务是否在跑(watchdog 随服务);手动 `reindex` 兜底 |

## 前端(可视化五视图)

服务启动后浏览器开 `http://127.0.0.1:<port>/ui/`:架构总览(分层泳道图,单击节点=焦点模式/双击=详情,可切力导)、模块详情、影响面分析(导出回归清单 md)、记忆检索、库健康。**运行不需要 Node**(`webui/dist` 产物随仓库);改前端才需要:`cd webui && pnpm install && pnpm dev`(dev 走代理连 61397),改完 `pnpm build` 并把 dist 一起提交。

## 开发

`src/memoryhub/`:config(实例配置)→ scanner(md 解析)→ store(SQLite/FTS5/vec0/图谱派生表)→ embedder(API 客户端)→ indexer(编排+watchdog)→ arch(图谱解析/围栏/查询)→ search(三模式 RRF)→ server(MCP+REST+/ui)→ cli。改代码后 `uv run memoryhub ...` 即时生效;规划文档暂存于 BoardGameEditor 工作区 `.htyworkflows/plans/2026-07-17-multi-plan-memoryhub-knowledge-system/`(完工后迁入本仓 docs/)。
