# MemoryHub embedding 供应商注册与 key 配置 — 待选项池

**日期**:2026-07-17
**状态**:已完成(2026-07-17 AI 代跑 ①~④ + 10 条质量抽测,向量层解锁)
**关联**:`.htyworkflows/plans/2026-07-17-multi-plan-memoryhub-knowledge-system/2026-07-17-memory-vector-db-service.md`(plan-1 Step 3 向量索引已解锁;Step 4 抽测结果见下)

---

## 1. 背景上下文

MemoryHub 检索核心已定"云 embedding API + OpenAI 兼容协议 + 供应商用户自配"。开发(plan-auto-execute)已启动:纯关键词链路(FTS5)不依赖 key 先行;**向量索引与 hybrid 检索(plan-1 Step 3/4)需要用户先注册一家供应商并把 key 配到环境变量**。用户选择稍后自行操作,先入池防忘。

## 2. 池中各待选项

### 2.1 本地 Ollama 部署(当前方案,用户命令行自操作手册)

- **优先级**:高(唯一阻塞向量能力的外部依赖)
- **触发条件**:用户有空时照下面命令逐条执行
- **操作手册**(PowerShell,共四步;②③完成即可交回 AI,④可选自跑):

  ```powershell
  # ① 安装 Ollama(装完自动常驻托盘,127.0.0.1:11434,默认开机自启)
  winget install Ollama.Ollama
  # 装完后【新开一个终端】再继续(PATH 与服务刷新)

  # ② 拉取 bge-m3 模型(~1.2GB,几分钟)并验证
  ollama pull bge-m3
  ollama list                                        # 应列出 bge-m3
  curl.exe http://127.0.0.1:11434/api/version        # 应返回版本号 JSON

  # ③ 设 key 占位值(协议要求带 key,Ollama 不校验;User 级持久化)
  [Environment]::SetEnvironmentVariable("MEMORYHUB_EMBED_API_KEY", "ollama-local", "User")

  # ④(可选,回会话说"装好了"让 AI 代跑亦可)初始化 + 全量嵌入
  #    注意:③ 设的是 User 级,当前终端需先补进程级变量:
  $env:MEMORYHUB_EMBED_API_KEY = "ollama-local"
  cd G:\hty_workflows\HtyMemoryHub
  uv run memoryhub init -w E:\UnityProject\BoardGameEditor --base-url http://127.0.0.1:11434/v1 --model bge-m3
  uv run memoryhub reindex -w E:\UnityProject\BoardGameEditor
  ```

  完成后回会话说一声(哪怕只做完 ①②③)——AI 接手跑 init/reindex(若未自跑)与 **10 条质量抽测**贴你过目。
- **验证方法**:`ollama list` 见 bge-m3;init 探测报 dim=1024;`memoryhub reindex` 全量嵌入无失败(库规模随记忆增减浮动)。
- **状态**:已完成(2026-07-17)
  - ① `winget install Ollama.Ollama` → 0.32.1,服务 `{"version":"0.32.1"}`
  - ② `ollama pull bge-m3` → 1.2GB success;`ollama list` 见 bge-m3:latest
  - ③ User 级 `MEMORYHUB_EMBED_API_KEY=ollama-local`
  - ④ `init` dim=1024 写入 `.htyworkflows/memoryhub/config.json`;`reindex` → 关键词层 364 docs / 向量层 364 docs · 560 chunks(无失败;相对计划时 382/595 为库自然增减)
  - **10 条质量抽测**(hybrid/vector/keyword 混测,判据=预期记忆进 top3):**10/10 命中**(详见下方抽测表)

### 2.1b 云供应商备选(未来切换参考;换供应商 = 重跑 init + reindex --force)

原云方案供应商表(任选一家,OpenAI 兼容):

  | 供应商 | 注册 / 控制台 | base_url | model | 备注 |
  |---|---|---|---|---|
  | **阿里云百炼(推荐)** | https://bailian.console.aliyun.com | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `text-embedding-v4` | 国内直连,中文第一梯队,有免费额度,全量索引 <¥0.5 |
  | 智谱 AI | https://open.bigmodel.cn | `https://open.bigmodel.cn/api/paas/v4` | `embedding-3` | 国内直连 |
  | SiliconFlow | https://cloud.siliconflow.cn | `https://api.siliconflow.cn/v1` | `BAAI/bge-m3` | 注册送额度,有免费档,零成本试跑可选 |
  | OpenAI | https://platform.openai.com | `https://api.openai.com/v1` | `text-embedding-3-small` | 需国际网络+国际支付 |

  操作三步:① 登录控制台找「API-KEY 管理 / API Keys」创建并复制 key;② PowerShell 配用户级环境变量:
  ```powershell
  [Environment]::SetEnvironmentVariable("MEMORYHUB_EMBED_API_KEY", "你的key", "User")
  ```
  ③ 回到会话告诉 AI 选了哪家(AI 据此把 init 默认 base_url/model 对齐,并解锁 Step 3 全量向量索引)。
- **验证方法**:新开 PowerShell `[Environment]::GetEnvironmentVariable("MEMORYHUB_EMBED_API_KEY","User")` 非空;`memoryhub reindex` 全量嵌入 382 文件无失败。
- **状态**:备选(未启用;当前方案见 2.1 本地 Ollama)

## 3. 风险 / 暂不做的理由

非"不做",仅用户时间安排。风险:若拖到 Step 3 联调时仍未配,向量/hybrid 相关开发只能对 mock 维度自测,真实质量抽测(Step 4 十条查询)顺延。

## 4. 何时回顾这个池

开发推进到 plan-1 Step 3 时 AI 主动提醒;或用户配好后主动告知。

> **归档约定**(用户 2026-07-17 叮嘱):主题群完工做文档归档迁移时,本文件随计划/svg 一并迁至 hty_workflows 侧(已登记进 manager 第 6 段收尾清单)。

## 5. 历史变更

| 日期 | 改动 |
|---|---|
| 2026-07-17 | 创建,含 1 个待办项(供应商注册+key 配置) |
| 2026-07-17 | **方案变更**:用户改选本地 Ollama + bge-m3(DeepSeek 无 embeddings 端点触发重议)。原"云供应商注册+key"三步改为:① 装 Ollama(https://ollama.com/download);② 告知 AI → AI 代跑 `ollama pull bge-m3` + init + reindex + 抽测;key 环境变量填任意值(协议占位,Ollama 不校验)。云供应商表保留作未来切换参考 |
| 2026-07-17 | 应用户要求将 2.1 重写为**命令行自操作手册**(winget 装 Ollama → pull bge-m3 → key 占位 → 可选自跑 init/reindex,四步带验证);云方案降为 2.1b 备选段 |
| 2026-07-17 | **执行完成**:用户指令执行本池 → AI 代跑 ①~④ 全绿;10 条质量抽测 10/10 top3 命中;plan-1 Step 3 向量阻塞解除 |

---

## 6. 质量抽测结果(2026-07-17,Ollama bge-m3)

| # | mode | query | top1(或 top3 内预期) | 命中 |
|---|---|---|---|---|
| 1 | keyword | `BUG-105` | `feedback_no_assumption_evidence_before_action`(snippet 含 BUG-105) | ✅ |
| 2 | vector | `为什么禁止兜底逻辑` | `feedback_no_fallback` | ✅ |
| 3 | hybrid | `嬴政 弹窗` | top3=`project-twelve-legions-tips-system`(槽0/嬴政) | ✅ |
| 4 | hybrid | `联机不同步` | `project_statesync_architecture` | ✅ |
| 5 | hybrid | `手牌 出牌 回调` | `feedback-handcard-play-callback-contract` | ✅ |
| 6 | vector | `手牌回调契约相关记忆` | `feedback-handcard-play-callback-contract` | ✅ |
| 7 | hybrid | `代码因果自洽` | `feedback_code_causal_self_consistency` | ✅ |
| 8 | hybrid | `根因式修复` | `feedback_rootcause_fix` | ✅ |
| 9 | vector | `卡牌容器视角投影怎么做` | `project_cardpile_server_multi_bucket_architecture` | ✅ |
| 10 | hybrid | `Display 数据变化客户端不同步` | `project_entity_sync_pipeline`(+top3 delta strip) | ✅ |

**汇总**:10/10 ≥ 计划门槛(≥8/10)。请用户过目后,plan-1 Step 4 抽测硬门可放行 → 再落 CLAUDE.md memoryhub 优先条款(Step 7 第 3 项)。
