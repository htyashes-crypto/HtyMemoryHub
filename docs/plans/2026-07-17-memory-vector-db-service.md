# MemoryHub 子计划 1:检索核心服务——外部工具语义直查记忆库

**日期**:2026-07-17
**任务类型**:需求实现(前置调研=代码/数据现状 + 用户需求逐条对齐,非 BUG 根因)
**状态**:3 个决策点已于 2026-07-17 全部确认,待用户下执行令
**前置依赖**:无(独立工具链项目;不触碰 Unity 工程代码与 ActFramework 资产)
**所属主题群**:[global-plan-manager.md](./global-plan-manager.md)——MemoryHub 项目知识系统(检索核心 → 架构图谱 → 前端 / 沉淀闭环);本文件是主题群第 1 步,后续子 plan 依赖本计划的服务骨架与 SQLite 库

---

## 1. 目标

为工作区记忆库建一套**常驻本地 HTTP 检索服务(MemoryHub)**:外部工具(Claude Code / Codex / 任意脚本)通过 **MCP 工具调用或 REST API,用关键词或自然语句一步拿到最相关记忆**,替代当前"AI 读 MEMORY.md 索引 → 封面链逐层下钻 3~4 跳"的低效模式。检索质量目标:语义查询(如"联机不同步")能命中未含该字面词的记忆(如 StateSync 收敛),关键词查询(如"BUG-105")能精确命中。

## 2. 背景(现状调研实录)

### 2.1 记忆库现状(已实测)

- **权威库**:`E:\UnityProject\BoardGameEditor\.htyworkflows\memory\`,**382 个 md 文件 ≈ 1.2MB**,按 12 个组文件夹分层(`index_0_set_core` ~ `index_11_legion`),一债一文件、文件名即身份。
- **Claude 产品缓存**:`C:\Users\admin\.claude\projects\E--UnityProject-BoardGameEditor\memory\`(384 文件),与权威库**同构双写镜像**。双写契约见 `.htyworkflows/AgentDocument/Codex规则-Skill与记忆路径对照.md`:"先写共享 memory(权威),再同步 Claude 产品缓存;禁止只写缓存"。→ **向量库只索引权威库一处**,否则内容重复。
- **文件格式**(实测样例 `feedback_rootcause_fix.md`):YAML frontmatter(`name` / `description` / `type`,注意 name 存在中文值,与索引描述的 kebab-case 不完全一致)+ 正文(Why / How to apply / `[[wiki链]]`)。→ scanner 必须以 **basename 为主键**,frontmatter 字段容错解析。
- **现有检索模式**:MEMORY.md 常驻索引 + 封面链(`index_0_*.md`)人工下钻,叶组 3 跳、set 组 4 跳——即用户抱怨的低效、不准确来源。

### 2.2 环境与既有模式(已实测)

- Python 3.13.5 + uv 0.11.19 + pip 25.1.1 + Node 22.16.0 齐备;本机有 RTX 4090(**本计划不用**,已定走云 API)。
- **htybox 先例**:`.mcp.json` 已注册本地 HTTP 型 MCP 服务 `http://127.0.0.1:61297/mcp` + Bearer token 环境变量引用,Claude Code 与 Codex 共接——本计划服务形态直接复用该模式。
- 工程当前**非有效 git 仓库**(`git rev-parse` 报 not a repository),BGE 侧实例 db 无 ignore 问题。
- ~~新工具放 `.htyworkflows/tools/` 符合惯例~~(初稿判断,已被 2026-07-17 工程组织定案取代:代码在 `G:\hty_workflows\HtyMemoryHub\` 独立应用开发,BGE 只留实例物,见 2.3 表末行与 manager 共识区)。

### 2.3 用户需求对齐(2026-07-17 问答确认)

| 用户决策 | 内容 | 对设计的约束 |
|---|---|---|
| 向量化方案 | **云 embedding API**("API Key 即可,要保证其他电脑上也可以用") | 不依赖本机 GPU;工具须可移植;key 不落盘 |
| 服务形态 | **常驻 HTTP 服务**(htybox 模式) | MCP(HTTP)+ REST + CLI 三入口;模型/索引常驻,检索毫秒级 |
| 覆盖范围 | **每个工作区独立数据库** | 非中心化多 root;代码可复制到任何工作区,db/config 随工作区走 |
| 检索方式 | 用户原话"通过**关键词或者语句**获取" | 混合检索:向量语义 + 全文关键词,融合排序 |
| 系统定位(2026-07-17 二轮) | 检索只是第一步:还要架构图谱/影响面、可视化前端、沉淀闭环 | 本计划收敛为主题群子计划 1(检索核心),扩展需求拆至子 plan 2/3/4,见 [global-plan-manager.md](./global-plan-manager.md) |
| 工程组织(2026-07-17 三次澄清定案) | 代码自始至终在 `G:\hty_workflows\HtyMemoryHub\` 开发(hty 生态应用);计划/svg/会话留 BGE,完工仅迁文档 | 计划中 `HtyMemoryHub/` = 该工程根;BGE 只落实例物(config/db/.mcp.json/CLAUDE.md 条款);部署=git clone 非拷目录 |

## 3. 决策点(已于 2026-07-17 全部确认,原选项分析由结论取代)

| 决策 | 用户拍板 | 落地方式 |
|---|---|---|
| 1. Embedding 供应商 | **由用户自行配置,可选任意供应商** | 不绑定默认家;`memoryhub init` 交互引导填 OpenAI-compatible `base_url + model`,key 走环境变量 `MEMORYHUB_EMBED_API_KEY`;init 时实调一次 API 探测向量维度写入 config 与模型指纹;README 附阿里百炼 / 智谱 / OpenAI / SiliconFlow 四家配置样例。**2026-07-17 执行期变更**:DeepSeek 无 embeddings 端点(官方文档实证)引发重议,用户改选**本地 Ollama + bge-m3**(base_url=http://127.0.0.1:11434/v1,dim 1024,key 填任意值)——仍属 OpenAI-compatible 自配范畴,零代码改动;4090 上 ~1.2GB 显存常驻、查询 <10ms |
| 2. 启动方式 | **先暂时手动启动** | `memoryhub serve` + 双击 `start-memoryhub.bat`;登录自启不做(以后需要再说,见第 9 段) |
| 3. CLAUDE.md 接入 | **确认接入** | Step 7 落地"记忆检索优先 memoryhub"条款,措辞落笔前贴用户过目 |

## 4. 设计原则

1. **本子计划只做读路径**:记忆的增删改与双写暂仍走既有 `boardgame-memory-skill-update` 流程,写入 API 与沉淀闭环由[子计划 4](./2026-07-17-memory-write-lifecycle.md) 承接。索引是记忆文件的**派生物**,可随时全量重建——权威永远是 md 文件,不引入第二个权威数据源。store 层建表带 `schema_version` 迁移机制,为子计划 2(图谱表)/ 4(写入)演进预留,后续加表不推倒重来。
2. **只索引权威库** `.htyworkflows/memory/`(双写契约实证,见 2.1),Claude 缓存目录不碰。
3. **工程 / 实例分离**(工程组织定案,见 manager 共识区):代码 = `HtyMemoryHub/`(即 `G:\hty_workflows\HtyMemoryHub\`,hty 生态应用,uv 项目 + 独立 git 仓);实例数据/配置 = 各使用方工作区的 `.htyworkflows/memoryhub/`(db + config.json,BGE 为首个);`serve --workspace <工作区根>`(或实例 config 定位)按工作区起实例。换电脑/其他工程部署 = git clone + `uv sync` + `init` + `reindex` + `serve`,写进 README。
4. **供应商是配置不是代码**:embedding 走 OpenAI-compatible `/v1/embeddings`(httpx 直调,尊重系统代理环境变量);`config.json` 存 base_url/model/维度,**API key 只走环境变量** `MEMORYHUB_EMBED_API_KEY`,不落任何文件。
5. **混合检索双入口**:向量语义(语句)+ SQLite FTS5 关键词(jieba 中文分词),RRF 融合排序——对应用户"关键词或者语句"两种查询形态;支持 `mode=vector|keyword|hybrid` 显式指定。
6. **失败明确报错,无静默降级**:embedding API 不可用时 `hybrid/vector` 查询直接返回明确错误(附"可改用 mode=keyword"提示),由调用方决定是否降级——不做暗中切换掩盖故障。
7. **模型指纹守卫**:库内记录 `base_url+model+维度` 指纹,启动/索引时校验,不匹配则拒绝增量并提示强制 `reindex --force`——杜绝"两种模型的向量混在一个库里"的脏数据。
8. 技术栈:Python 3.13 + uv;**sqlite-vec**(单文件向量库,382 条规模绰绰有余,零外部服务)+ SQLite FTS5 + jieba + FastMCP(streamable-http)挂 uvicorn,REST 路由同进程共存;CLI 用 typer。

### 4.1 架构与数据流

```
.htyworkflows/memory/**/*.md ──(watchdog 监控 + content-hash 增量)──> Indexer
                                                                        │ scanner: frontmatter+正文解析(basename 主键)
                                                                        │ embedder: OpenAI-compatible /v1/embeddings(batch≤64,重试)
                                                                        ▼
                                              SQLite 单文件 .htyworkflows/memoryhub/db/memory.db
                                                ├─ documents(路径/组/type/description/hash/mtime)
                                                ├─ vec0 虚表(chunk 向量;长文按标题切块,文档得分取块最大值)
                                                ├─ fts5 虚表(name/description/jieba 预分词正文)
                                                └─ meta(模型指纹/索引时间)
                                                                        ▲
外部工具 ──┬─ MCP: http://127.0.0.1:61397/mcp(memory_search / memory_get / memory_stats)
           ├─ REST: GET /search /doc/{name} /stats /healthz,POST /reindex
           └─ CLI: memoryhub init|serve|reindex|search|get|status(serve --workspace 定位实例)
查询流:query ─┬─ embed(query) → 向量 top30 ─┐
              └─ jieba 分词 → FTS5 top30 ──┴─ RRF 融合 → top_k{name,path,group,type,description,score,snippet}
```

- **检索返回形态**(token 经济):`memory_search` 默认返回元数据+description+命中片段(snippet),`include_body=true` 或 `memory_get(names)` 才给全文——AI 先扫结果再按需取全文,两步合计仍远快于 3~4 跳索引下钻。
- **切块策略**:绝大多数记忆 <4KB 整篇单块;超长文(封面索引/大型 project 记忆)按 `##` 标题切块,块内保留 frontmatter description 作上下文前缀。
- **端口**:默认 61397(避开 htybox 61297),`config.json` 可改;绑定 127.0.0.1;Bearer token 可选(config 留空=本机免鉴权,与 htybox 对齐时再启用)。

## 5. 文件清单

### 5.1 新增

| 路径 | 职责 |
|---|---|
| `HtyMemoryHub/pyproject.toml` | uv 项目定义与依赖锁定(mcp、uvicorn、httpx、sqlite-vec、jieba、watchdog、pyyaml、typer) |
| `HtyMemoryHub/README.md` | 部署/移植手册:新电脑接入五步、key 环境变量、故障排查(FTS5 自检/端口冲突/指纹不匹配) |
| `HtyMemoryHub/src/memoryhub/config.py` | 加载 `.htyworkflows/memoryhub/config.json` + 环境变量 key;工作区根定位 |
| `HtyMemoryHub/src/memoryhub/scanner.py` | memory 目录扫描、frontmatter 容错解析、content-hash 增量差集 |
| `HtyMemoryHub/src/memoryhub/embedder.py` | OpenAI-compatible embeddings 客户端(batch、指数退避重试、维度校验) |
| `HtyMemoryHub/src/memoryhub/store.py` | SQLite 存取:vec0/fts5 建表、写入、向量/关键词/RRF 混合查询 |
| `HtyMemoryHub/src/memoryhub/indexer.py` | 全量/增量索引编排 + watchdog 目录监控(debounce 2s) |
| `HtyMemoryHub/src/memoryhub/server.py` | FastMCP streamable-http(3 个 MCP 工具)+ REST 路由,单 uvicorn 进程 |
| `HtyMemoryHub/src/memoryhub/cli.py` | `init / serve / reindex / search / get / status`(init=交互式供应商配置+维度探测) |
| `HtyMemoryHub/start-memoryhub.bat` | 双击启动壳(内部 `uv run memoryhub serve --workspace ...`;各工作区可建快捷方式带各自参数) |
| `.htyworkflows/memoryhub/config.json` | 工作区实例配置:端口、memory 根、embedding base_url/model/维度(不含 key) |
| `.htyworkflows/memoryhub/db/`(运行时生成) | memory.db;若未来工程 git 化须入 ignore |

### 5.2 修改

| 路径 | 改动概要 |
|---|---|
| `.mcp.json` | 增 `"memoryhub": { "type": "http", "url": "http://127.0.0.1:61397/mcp" }` |
| `.claude/CLAUDE.md` | (决策 3=A 时)「工具使用」段增约 3 行:记忆检索优先 memoryhub `memory_search`,索引下钻为后备 |

### 5.3 删除

| 路径 | 原因 |
|---|---|
| (无) | MEMORY.md 索引体系保留(权威组织结构 + 人工入口 + 服务后备) |

## 6. 实施步骤

### Step 1 — 工程初始化与环境自检(于 `G:\hty_workflows\HtyMemoryHub\`,已建空目录)
- [x] `uv init` + `git init`(独立仓,HtyBox 模式)+ .gitignore(venv/db 等),锁定依赖;写 config.py(实例 config.json 模板生成 + key 环境变量读取 + `--workspace` 工作区定位)
- [x] 启动自检:Python sqlite3 FTS5 可用性、sqlite-vec 扩展加载(Windows/Py3.13 wheel)——失败给可读报错
- ✅ 2026-07-17 验证通过:imports ok;status 报 382 个 .md、FTS5 ✓、sqlite-vec v0.1.9 ✓;已推 GitHub main(commit 4068f46);另修 typer 单命令折叠(加 @app.callback)与 Windows GBK 输出(入口统一 UTF-8)两处环境适配
- **验证**:`uv run python -c "import sqlite_vec, jieba, mcp"` 通过;`memoryhub status --workspace E:\UnityProject\BoardGameEditor` 打印配置与自检结果

### Step 2 — scanner + store(先纯关键词闭环,不依赖 API key)
- [x] scanner:递归扫 382 文件,frontmatter 容错解析(缺字段回退 basename/首行),content-hash 计算
- [x] store:建 documents/fts5 表,jieba 预分词入库;实现 keyword 检索
- ✅ 2026-07-17 验证通过:reindex 382 docs、二次跑零变更(hash 短路);"BUG-105" 命中 3 条相关记忆;"手牌 出牌 回调" top1=feedback-handcard-play-callback-contract;commit b6ed5a4

### Step 3 — embedder + 全量向量索引(需用户提供 key)
- [x] embedder:OpenAI-compatible 客户端(batch≤64、429/5xx 指数退避、维度校验);vec0 表 + 模型指纹 meta
- [x] 切块:>1500 token 按 `##` 切,description 作块前缀(执行中修正:补分级细分——封面索引类无空行长文曾产出 5526 超限块,现按 ##→空行→单行→硬切,全库 595 块合规,worst 3168 字符含 description 前缀)
- **验证**:✅ 2026-07-17 全量嵌入解锁——Ollama bge-m3 + `MEMORYHUB_EMBED_API_KEY=ollama-local`;`init` dim=1024;`reindex` 364 docs / 560 chunks 无失败(plans_waitChoose/2026-07-17-memoryhub-embed-key-setup.md 已结);离线部分此前已过:v1→v2 migration、无 embedding 报错面、切块合规;commit 0a9edab

### Step 4 — 混合检索与质量抽测
- [x] RRF 融合(k=60)实现 `hybrid` 模式;snippet 生成(命中词/最相关块摘录)——run_search 统一入口,CLI/服务端共用;RRF 合并逻辑直测通过(双路居首/高亮保留/独有入列),keyword 模式经新路径回归 ✓;commit 待 Step 5 合并推送
- [x] 用 10 条典型查询抽测——✅ 2026-07-17 key/Ollama 就位后跑完,**10/10 top3 命中**(明细见 waitChoose `2026-07-17-memoryhub-embed-key-setup.md` §6),**待用户过目确认**后放行 Step 7 CLAUDE.md 条款
- [x] 独立复测(本会话另拟 10 条,2026-07-19):**9/10 top3 命中**,两轮互证过门槛。唯一失败例 "BUG-105"(hybrid)归因:keyword 模式三条全中,败因=代号类 query 向量路语义弱+RRF 稀释 → 处理为使用指引(memory_search 工具描述注明"代号/ID 类查询用 mode=keyword"),不加隐式加权补丁;另补修 embedder 回环端点直连(系统代理拦 127.0.0.1 httpx);commit 8d252e1
- **验证**:10 条查询 top3 内命中预期记忆 ≥8 条 → 实测 10/10;不达标先调 RRF 权重/切块粒度再交付
- **⚠️ 交付判据前移(执行期调序说明)**:原定"抽测过目后才进 Step 5"因 key 阻塞调整为——Step 5/6 服务化先行(keyword 路径可完整验证),**抽测过目改为 key 就位后、CLAUDE.md 接入(Step 7 第 3 项)之前的硬门**:质量未过用户目,不切 AI 检索行为

### Step 5 — 常驻服务(MCP + REST)与 Claude Code 接入
- [x] server.py:FastMCP 挂 `memory_search / memory_get / memory_stats`;REST `/search /doc/{name} /stats /healthz /reindex`;uvicorn 绑 127.0.0.1:61397
- [x] `.mcp.json` 注册 memoryhub;⏸ Claude Code 会话内实测需**重启会话**后进行(本会话启动时 memoryhub 尚未注册),留待用户下次会话或 Step 7 收尾一并
- ✅ 2026-07-17 验证:REST /healthz /stats /search(联机不同步→network 组命中)全通;MCP 客户端全流程(initialize/list_tools/call_tool)通过;commit 1da8229
- 📌 执行期排查沉淀:本机**系统代理(注册表级)会拦 python httpx 测试客户端**(httpx 经 urllib.getproxies 读注册表代理且不处理 ProxyOverride 本地例外)→ 403 无 uvicorn 头;服务端与 Claude Code(Node 客户端,htybox 同回环端口实证)不受影响;python 侧测试用 `trust_env=False` 工厂;已记入 README 排查章节(Step 7)
### Step 6 — watchdog 增量同步
- [x] indexer 集成 watchdog:监控 memory 目录,变更 debounce 2s 后增量重嵌(新增/修改/删除/改名——全量对账式 scan+hash diff,天然覆盖四类且免精细事件分派)
- ✅ 2026-07-17 验证(临时工作区,未触碰权威库):增 gamma/改 alpha/删 beta 三类变更 5s 内 lastIndexed 刷新、新内容可搜、删除内容零结果、docs 计数正确;commit 421c163;BGE 正式服务(61397+watchdog)已长驻

### Step 7 — 移植文档 + 工作流接入(启动方式=手动,已确认)
- [x] `memoryhub init` 命令:交互/参数双模式引导 base_url/model → 实调 API 探测维度 → 生成 config.json;start-memoryhub.bat(⏸ init 真实探测等 key,无 key 报错面已验)
- [x] README:新电脑/新工程五步部署(git clone→uv sync→init 配供应商→reindex→serve --workspace)+ 四家供应商配置样例 + 排查表(含系统代理拦 httpx 项);✅ 干净目录 clone 演练:sync 后 status 自检全绿;commit 582b7f5
- [ ] ⏸ CLAUDE.md「工具使用」段加 memoryhub 优先条款——**用户 2026-07-19 指示挪至主题群最后统一做**(抽测已两轮过门槛,非质量问题;草案已备,见第 11.5 后续);随 plan-4 工作流条款一并落最合理
- **验证**:按 README 步骤在干净目录模拟迁移可完整复现服务 ✅;MCP 会话内实测 ✅(2026-07-19 memory_search 一步 top1 命中 feedback-handcard-play-callback-contract,即整体验收第 4 条);AI 检索行为切换随条款落盘后验

## 7. 测试验证(整体验收)

1. **全量索引**:`memoryhub reindex` → 382 docs / 0 failed;`status` 显示模型指纹、向量数、FTS 条目数。
2. **三模式检索**:`search -m keyword "BUG-105"`、`search -m vector "为什么禁止兜底逻辑"`、`search "嬴政 弹窗"`(hybrid)各自 top3 命中预期(Step 4 的 10 条抽测清单跑全绿)。
3. **REST**:curl /search、/doc/{name}、/stats、/healthz 返回正确 JSON;错误 query 返回 4xx + 明确 message。
4. **MCP 端到端**:Claude Code 新会话中直接问"查一下手牌回调契约相关记忆",AI 经 `memory_search` 一步命中 `feedback-handcard-play-callback-contract`——对比旧流程(MEMORY.md→legion 封面→文件)的 3 跳。
5. **增量**:改/增/删记忆文件各一次,5s 内检索结果反映变化。
6. **故障面**:临时清空 key 环境变量重启 → hybrid 查询返回明确错误并提示 keyword 模式;`-m keyword` 仍正常工作。
7. **部署演练**:按 README 在干净位置 git clone(模拟新电脑/新工程)完成五步部署,对一个测试工作区检索可用。

## 8. 风险 / 注意事项

| 风险 | 缓解 |
|---|---|
| 云 API 网络抖动/限流(国内) | httpx 尊重系统代理;batch+指数退避;reindex 断点续跑(hash 已入库的跳过);README 供应商样例标注国内直连项 |
| 换 embedding 模型/维度导致向量混库 | meta 模型指纹强校验,不匹配拒绝增量、要求 `reindex --force`(设计原则 7) |
| Py3.13/Windows 下 sqlite-vec 或 FTS5 不可用 | Step 1 启动自检前置暴雷;README 排查章节;极端情况可降 Python 3.12(uv 管理版本,一行切换) |
| frontmatter 不规范(中文 name/缺字段) | scanner 以 basename 为主键 + 容错回退(2.1 已实证存在此类文件) |
| 端口 61397 被占 | config.json 可改;启动失败报错带"改端口 + 同步改 .mcp.json"指引 |
| AI 不用新工具照旧走索引 | 决策 3 的 CLAUDE.md 条款是行为开关;验收第 4 条端到端验证 |
| 双库重复索引 | 只索引权威库(设计原则 2,有双写契约文档实证) |
| 记忆更新但服务没开→索引陈旧 | serve 启动时先做一次全量 hash 对账再进 watchdog;检索结果附 last_indexed 时间戳供调用方判断新鲜度 |

## 9. 不在本计划范围(多数由主题群兄弟子 plan 承接)

- **架构图谱与影响面分析**(模块/关系/回归波及)→ [子计划 2](./2026-07-17-arch-knowledge-graph.md)
- **可视化前端页面** → [子计划 3](./2026-07-17-web-dashboard.md)
- **记忆写入 API、沉淀闭环、一致性维护** → [子计划 4](./2026-07-17-memory-write-lifecycle.md)
- 登录自启注册(用户暂定手动启动,以后需要再加,一个 schtasks 子命令的事)
- 跨电脑/跨工作区**中心化**服务与数据同步(已定工作区独立;各自 clone 部署、各自建库)
- 其他工程(GMApp/HtyHubApp 等)的实际接入(从 HtyMemoryHub 仓库 clone 即可,但本主题群只部署 BGE 实例)
- 计划/svg 文档的收尾归档迁移(完工后迁 hty_workflows 侧,见 manager 第 6 段)
- 检索质量持续评测集、rerank 精排模型(初版 RRF 够用,质量不达标时再议)
- `.htyworkflows/skills`、`user-real-design` 等其他知识目录的索引(初版只做 memory;config 的 roots 列表已预留多目录扩展)

## 10. 待用户拍板

(无——3 个决策已于 2026-07-17 确认:供应商用户自配 / 手动启动 / 确认接入 CLAUDE.md。)

执行前唯一前置:跑 `memoryhub init` 时按引导填入你选定供应商的 base_url/model,并把 key 配到环境变量 `MEMORYHUB_EMBED_API_KEY`。收到执行令即可开始 Step 1。

## 11. 执行记录

**执行日期**:2026-07-17 ~ 2026-07-19
**执行模式**:AI 自动执行(plan-auto-execute)+ 用户自操作(Ollama 部署/init/reindex 按 waitchoose 手册)+ 另一会话并行推进(抽测第一轮/计划回写)

### 11.1 决策汇总(含执行期变更)
| 项 | 结果 | 说明 |
|---|---|---|
| 供应商(执行期变更) | 本地 Ollama + bge-m3(dim 1024) | DeepSeek 无 embeddings 端点(官方文档实证)触发重议;仍属 OpenAI-compatible 自配,零代码改动 |
| MCP 传输模式(执行期补录) | 有状态 streamable-http | stateless 与 SDK 客户端会话头流程不匹配 |
| 代号类查询策略(执行期补录) | 使用指引而非隐式加权 | "BUG-105" hybrid 被向量路稀释;工具描述注明 mode=keyword |

### 11.2 实际改动文件
| 路径 | 概要 | Step |
|---|---|---|
| `HtyMemoryHub/`(G:\hty_workflows\)全工程 | config/scanner/store/embedder/indexer/search/server/cli 8 模块 + bat + README,8 commits(4068f46→8d252e1)推 GitHub main | 1~7 |
| BGE `.mcp.json` | 注册 memoryhub(http://127.0.0.1:61397/mcp) | 5 |
| BGE `.htyworkflows/memoryhub/` | 实例 config.json(用户 init)+ db(364 docs/560 chunks/560 vectors) | 3 |

### 11.3 验证结果(对照第 7 段)
- [x] 1 全量索引(364 docs,记忆库经外部会话整理 382→364,watchdog 同步)
- [x] 2 三模式检索:抽测两轮 10/10 + 9/10(门槛 ≥8),失败例已归因
- [x] 3 REST 四端点 + 错误面
- [x] 4 MCP 端到端:会话内 memory_search 一步 top1 命中目标记忆
- [x] 5 watchdog 增量(临时工作区实测增/改/删)
- [x] 6 故障面(无 key/无 embedding 报错面;等价覆盖)
- [x] 7 部署演练(干净目录 clone+sync+status 全绿)

### 11.4 偏离计划之处
| 项 | 计划设想 | 实际 | 原因 |
|---|---|---|---|
| Step 4 抽测时序 | 抽测过目后才进 Step 5 | Step 5/6 先行,抽测在 key 就位后补 | key 外部依赖阻塞,用户授权跳过 |
| CLAUDE.md 条款 | Step 7 内落盘 | 挪主题群最后统一做 | 用户 2026-07-19 指示 |
| 切块聚合 | 按 ## 切+空行聚合 | 补分级细分(##→空行→单行→硬切) | 无空行长文产出 5526 超限块(执行中发现的缺陷,根因修复) |

### 11.5 后续工作
- CLAUDE.md「记忆检索优先」条款落盘(草案已备,主题群收尾时与 plan-4 工作流条款一并)+ 新会话行为验证
- plan-2 起执行(用户 2026-07-19 下令按原序继续)

### 11.6 触发的新风险 / 已知技术债
- 本机系统代理拦 httpx 回环请求(已根治:embedder 回环直连;README 排查表收录)——影响所有 python httpx 客户端对本机服务的调试,属环境知识
- 记忆库内容由外部会话并行演变(382→364):MemoryHub 对账式设计天然兼容,无债;提示后续 lint(plan-4)上线前不宜假设文档数恒定
