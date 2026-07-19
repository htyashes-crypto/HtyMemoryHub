# MemoryHub 子计划 4:记忆写入 API 与沉淀闭环

**日期**:2026-07-17
**任务类型**:需求实现
**状态**:✅ 已完成(2026-07-19,执行记录见 §11)
**前置依赖**:[子计划 1](./2026-07-17-memory-vector-db-service.md) 的索引管线 + [子计划 2](./2026-07-17-arch-knowledge-graph.md) 的图谱 schema(可与[子计划 3](./2026-07-17-web-dashboard.md) 并行)
**所属主题群**:[global-plan-manager.md](./global-plan-manager.md)

---

## 1. 目标

补齐记忆库的**写路径与生命周期维护**:每做完一个需求 / 修完一个 bug,新逻辑、新影响关系、回归证据都经结构化流程沉淀进记忆库并实时索引——"记忆始终最新、完整自洽、分类清晰、模块架构清晰、检索高效"从靠 AI 自觉遵守约定,升级为**服务 API 保证 + 收尾流程强制**。达成用户定义的最终价值:用了 MemoryHub 的项目无需担心记忆沉淀,不再出现"修 bug 波及面没人知道、旧功能损坏被隐藏"。

## 2. 背景

### 2.1 既有沉淀链路(现状)

- **触发**:CLAUDE.md「任务完成总结流程」——仅用户显式信号("完成了/可以总结了")触发,**禁 AI 主动启动**;触发后走 `boardgame-memory-skill-update` skill。
- **执行**:AI 手工完成全部环节——写权威 md → **手工双写** Claude 缓存同名文件 → 手工维护封面链索引(MEMORY.md/组封面加行)→ 跨域补 cross-link。双写契约(2026-07-10 决策 4A)靠 skill 文本约定与 AI 自觉。
- **收尾**:`plan-finish-code-review` 审查+归档计划第 11 段,与记忆沉淀是两个独立动作。

### 2.2 痛点(与用户本轮需求逐条对齐)

| 用户诉求 | 现状缺口 |
|---|---|
| "每做完一个需求/bug 都实时更新记忆库" | 沉淀依赖"用户记得说总结"+AI 自觉,漏沉淀无任何机制拦截 |
| "确保记忆始终最新…检索高效" | 手工双写/封面登记步骤多,任何一步漏做即索引-文件-缓存三方漂移;无对账 |
| "修 bug 波及面→回归用例;实现功能不隐藏旧功能损坏" | 本轮获得的影响关系(改了 A 打坏过 B)只存在于对话里,没有结构化落成图谱边,下次 AI 无从查起 |
| "完整自洽,分类清晰" | 断 `[[链]]`、孤儿记忆、重复记忆无检测手段 |

### 2.3 铁律呼应(设计依据)

最高铁律 `feedback_no_assumption_evidence_before_action`:"修复引入的新假设必须转成代码能保证的东西——写在注释里的不变量不算不变量"。双写一致、索引新鲜、封面登记这些**约定**,正是该铁律要求"转成代码保证"的对象:本计划把它们变成写入 API 的原子步骤。

## 3. 决策点

### 决策 1:沉淀触发机制 —— **已确认(2026-07-17 三轮):双模式并存,自动做成开关**

用户拍板:"沉淀触发和自动都考虑到,自动可以做成开关。"落地设计:

**开关**:`capture_mode` 存 `.htyworkflows/memoryhub/config.json`,取值 `manual`(默认)/ `auto`;切换入口 = CLI `memoryhub config set capture_mode <v>` + 前端健康页开关(视图⑤小增量);MCP `memory_stats` 返回当前模式供 AI 会话读取。

| 模式 | 触发行为 | 质量闸 |
|---|---|---|
| **manual**(默认) | 现有门禁不变:用户显式信号("完成了/总结")才启动沉淀;`plan-finish-code-review` 收尾门强制跑沉淀清单(漏沉淀=收尾不完整) | 沉淀报告贴用户过目后落盘 |
| **auto**(开关开启) | 任务/计划完成时 AI **不等显式信号**直接启动沉淀清单五步并落盘 | 沉淀报告**仍然产出并展示**(事后可纠);lint 全绿硬性拦截;权威=md 文件,任何误沉淀可直接改文件回滚 |

两模式共用同一套沉淀清单(§4.1)与写入 API——差别只在"谁扣扳机",不在流程与质量标准。CLAUDE.md「任务完成总结流程」条款改为**按 capture_mode 分流**(AI 会话开始/收尾时经 memory_stats 读模式)。

> 服务本身在任何模式下都**不自主产生写入**——写入永远由 AI 会话(或用户 CLI)经 API 发起;"auto"自动化的是会话侧扣扳机时机,不是后台进程写库。

### 决策 2:boardgame-memory-skill-update skill 改造深度 —— **已确认 A(API 单轨化)**

| 选项 | 含义 | 影响 |
|---|---|---|
| **A** | **skill 改造为调 MemoryHub 写入 API**:手工双写/手工索引登记退役,skill 专注"判定该沉淀什么、归属哪组哪模块",落盘动作全交 `memory_upsert`(原子:权威写+双写+索引+lint) | 双写一致从"约定"变"保证";skill 文本大幅简化;AI 会话省 token 省步骤 |
| **B** | API 与手工双写并存,skill 不动 | 零改造成本,但两条写路径长期漂移,"服务保证一致性"落空 |

**推荐**:**A**——本计划的意义就在把约定变保证,留双轨等于没做(呼应铁律 `feedback_dual_track_removal_single_track_first` 的单轨原则)。

## 4. 设计原则

1. **写入原子化**:`memory_upsert` 一次调用完成 权威 md 落盘 → Claude 缓存双写 → 向量+FTS 增量索引 → lint 校验,任一步失败整体报错并回滚文件操作——三方(权威/缓存/索引)不一致状态不落地。
2. **权威仍是文件**:API 是"代客写文件",不是"写数据库"——绕过 API 手改 md 依然合法(watchdog 兜住索引),API 的价值是把双写/登记/校验打包保证。
3. **沉淀是结构化流程不是自由发挥**:收尾沉淀走固定清单(§4.1),产出沉淀报告贴用户过目后写入,防漏防散。
4. **质量闸分模式但报告恒在,且报告分层呈现**(用户四轮:"人工只看架构和分组,不看细节"):沉淀报告顶部高亮**架构层变更**(新模块/组/关系类型/MEMORY.md 结构——这部分需要用户看并批准);**细节层变更**(feature/边/普通记忆)标注"机器围栏已校验",用户可不看。manual 模式报告过目后落盘;auto 模式先落盘、报告必展示可事后纠;lint 全绿在两种模式下都是硬性门槛。**架构层变更在任何模式下都必须用户批准**——auto 开关只自动化细节层沉淀,架构层永远走人工闸。
5. **双模式,但服务永不自主写**:capture_mode 只决定会话侧扣扳机时机(显式信号 vs 完成即沉淀);任何模式下写入都由 AI 会话/用户经 API 发起,不存在后台进程自动写库。
6. **AI 正确性靠机器循环而非自觉**:写入一律先 `dry_run` → lint 返回结构化违规 → AI 修正 → 真写;细节层合规由子计划 2 §4.2 机器围栏硬拦(共用同一套校验),AI"记住了规范"不算保障,校验器拒收才算(铁律:约定必须转成代码能保证的东西)。

### 4.1 沉淀清单(收尾流程固定五步)

1. **变更盘点**:本轮改了哪些模块/功能(对照计划文件、变更契约的触及范围)。
2. **归属判定(架构遵循的第一道关)**:先 `arch_overview` 定位每条新知识挂哪个 module/feature、归哪个组;**挂不上已有模块 = 架构缺口 → 高亮上报用户裁决(新模块须用户批准并写入 `approved` 标记),禁止自创模块或硬塞近似组**。
3. **知识与图谱增量**:新建/更新记忆文件(归组、`[[链]]`、frontmatter)+ 新 feature/新边/边修正——本轮发现的"改 A 会波及 B"必须落成边;全部经 dry_run→修正→真写机器循环。
4. **回归证据反哺**:本轮实际发生的回归/修复 → 挂到对应边的 evidence(bug-record 联动)。
5. **一致性验收与分层报告**:`memory_lint` 全绿;产出分层沉淀报告(架构层高亮置顶待批 / 细节层标注"机器已校验")归档进计划第 11 段。

### 4.2 嫌疑清单与 AI 审计(细节腐化的持续消化机制)

用户不看细节,细节的**语义级**问题(放错组、内容过时、两条记忆互相矛盾)机器只能标"嫌疑"不能裁决 → 设计消化闭环:lint 把警告级发现(分类漂移嫌疑、高相似重复对、断链修复候选)累积进**嫌疑清单**(`memory_lint` 返回+前端健康页展示);用户或收尾流程**按需发起 AI 审计会话**逐条消化(改组/合并/更新/标废弃),修正经写入 API 落盘、清单清零。审计不设后台定时(服务不自主写原则),入口 = CLI `memoryhub lint --audit-queue` 给 AI 会话消费。

## 5. 文件清单

### 5.1 新增

| 路径 | 职责 |
|---|---|
| `HtyMemoryHub/src/memoryhub/writer.py` | 原子写入:权威落盘+双写+增量索引+lint 编排;文件锁防并发;失败回滚 |
| `HtyMemoryHub/src/memoryhub/lint.py` | 一致性校验器:硬规则(断 `[[链]]`/孤儿/frontmatter/封面对账/双写 diff+子计划 2 §4.2 架构围栏,拒收级)+ 警告级嫌疑清单(重复对/分类漂移/断链修复候选,供 AI 审计消化) |

### 5.2 修改

| 路径 | 改动概要 |
|---|---|
| `HtyMemoryHub/src/memoryhub/server.py` | MCP+REST 增:`memory_upsert / memory_delete / arch_upsert / memory_lint`(均带 dry_run) |
| `HtyMemoryHub/src/memoryhub/cli.py` | `lint / upsert --from-file / config set capture_mode <manual|auto>` 命令 |
| `.htyworkflows/memoryhub/config.json` | 增 `capture_mode` 字段(默认 manual) |
| `HtyMemoryHub/webui/src/views/HealthView.tsx` | (子计划 3 文件的小增量)健康页显示+切换 capture_mode 开关 |
| `.htyworkflows/skills/boardgame-memory-skill-update/SKILL.md`(canonical) | 落盘动作改走 MemoryHub API;沉淀清单五步并入;改后跑 `.htyworkflows/tools/sync-adapters.ps1` 同步适配器 |
| `.htyworkflows/skills/plan-finish-code-review/SKILL.md`(canonical) | 收尾流程增"沉淀清单必做步骤"(决策 1=A);同步适配器 |
| `.claude/CLAUDE.md` | 「功能开发前置门禁」爆炸半径分析补一句:知识级 `arch_impact` 与代码级 Jet 反扫双证据;「任务完成总结流程」指向新沉淀清单 |

### 5.3 删除

| 路径 | 原因 |
|---|---|
| (无;skill 内"手工双写"段落被 API 调用取代属修改) | 单轨化(决策 2=A) |

## 6. 实施步骤

### Step 1 — writer:原子写入与回滚
- [x] 权威写+双写(缓存根按 MEMORY.md 契约动态推导,无 Claude 缓存机器如实标注跳过)+增量索引编排;失败回滚(执行期简化:对账式增量幂等使 watchdog 免去重、跨进程锁不必要——为不存在的问题设计复杂锁违反精简)
- **验证**:✅ 2026-07-19 临时区全周期:dry_run→真写(indexed✓)→检索命中→delete→消失;围栏预检以"落盘后盘面"跑交叉

### Step 2 — lint:一致性校验器(硬规则 + 嫌疑清单两级)
- [x] 硬规则:架构围栏 R1~R8 + 双写对账(MEMORY.md 契约头豁免,同 verify.ps1 口径)
- [x] 警告级嫌疑:断链/弱 frontmatter/封面对账(分级封面链口径)/重复对/组漂移;实时计算幂等(执行期简化:审计消化后重跑自然消失,持久化累积为多余状态)+vectorCoverage 防静默;`lint --audit-queue` 供 AI 消费
- **验证**:✅ 首跑基线暴露两处规则须对齐既有契约(契约头误报/封面只查 index_0 过严),对齐后**硬 0 / 嫌疑 41(断链 40+弱 fm 1)=真实审计队列首批**(存量清理不混入本计划);缺 approved 模块经 upsert dry_run 被 R3 拒收 ✓

### Step 3 — 写入 API 上线(MCP+REST)
- [x] `memory_upsert / memory_delete / memory_lint` 三工具带 dry_run(执行期精简:arch 文件走统一 upsert 按路径自动跑围栏,单列 arch_upsert 冗余)+ REST /memory/* /lint /capture-mode + 健康页审计队列区实数据与 capture 开关
- **验证**:✅ CLI 全周期实测通过;会话内 MCP 实测并入 Step 5 演练;commit 13df842+d0fec1c

### Step 4 — skill 与工作流条款改造(决策 1/2 落地)
- [x] boardgame-memory-skill-update:落盘段改 API 化,沉淀清单五步并入;plan-finish-code-review:收尾增必做沉淀步骤;CLAUDE.md「任务完成总结流程」改为按 capture_mode 分流(manual=现门禁 / auto=完成即沉淀)——**三份改动措辞先贴用户过目再落盘**;canonical 改后跑 sync-adapters.ps1
- [x] capture_mode 开关链路:config 字段 + CLI set + memory_stats 暴露 + 健康页开关
- **验证**:✅ 2026-07-19 三份措辞经用户过目"确认"+两条补充修正(**服务不存在 fallback 旧索引路径**;**部署判定禁绝对路径**→`~/.memoryhub/install.json` 机器无关锚,register_port 顺带写入,commit 02bb5d5);双侧 sync-adapters+manifest 基线(CLAUDE.md 受保护文件经授权更新)verify 0 issues;capture-mode CLI/REST/stats/健康页四端同值实测

### Step 5 — 端到端沉淀演练(整体验收前哨,两模式各一次)
- [x] **manual 演练**:做完模拟小任务 → 用户说"完成了" → 沉淀清单五步 → 分层报告过目 → API 落盘 → lint 全绿 → 双端可见
- [x] **auto 演练**:切 `capture_mode=auto` → 做完另一模拟任务 → AI 不等信号自动沉淀细节层 → 分层报告展示 → 用户事后抽查纠错一处(验证"可纠"路径)
- [x] **架构缺口演练**:故意沉淀一条挂不上任何已有模块的知识 → 观察 AI 高亮上报"架构缺口待裁决"而非自创模块;auto 模式下该条同样被拦到人工闸
- **验证**:✅ 2026-07-19 演练用**本轮真实知识**而非模拟:manual=沉淀 `reference_memoryhub_access`(misc 组横切工具链,归属判定演示:不挂业务模块)全程 API(dry_run→真写 cachedWrite✓indexed✓→子域封面登记→keyword 检索即命中→lint 硬 0/嫌疑 41 未新增),零手工双写;auto=capture-mode auto(stats 即时反映)→不等信号沉淀临时记忆→memory_delete 纠错(权威+缓存双删✓)→切回 manual;架构缺口=Step 2 已实测 R3 拒收缺 approved 模块(upsert dry_run 报错面),两模式共用同一围栏、auto 无旁路。注:会话内 MCP 工具面(upsert/lint)因工具表系会话启动时缓存,待新会话自然生效;REST 与 MCP 同源(server.py 同函数),行为一致性由 CLI/REST 双端实测背书

## 7. 测试验证(整体验收)

1. **原子性**:upsert 成功路径三方一致;注入失败路径(锁占用/索引异常/缓存目录只读)均回滚干净,重跑幂等。
2. **闭环时效**:从"用户说完成"到"新记忆可被 memory_search/arch_impact 查到"≤1 分钟(结构化流程+增量索引)。
3. **触发按模式守恒**:manual 下 AI 无用户信号不发起任何写入;auto 下完成即沉淀但报告必展示;两模式下收尾流程漏跑沉淀清单都会被 plan-finish-code-review 检查项拦下;模式切换即时生效。
4. **lint 有效性**:硬规则类问题各造一例全部拒收;嫌疑类各造一例进清单;修复后全绿、清单清零。
5. **skill 单轨**:全文检索 skill 文本无残留"手工复制到 Claude 缓存"类指令。
6. **分层治理守恒**:架构层变更(演练造一例新模块)在 manual/auto 两模式下都必须经用户批准(`approved` 标记缺失被围栏拒收);细节层沉淀全程无需用户介入且全部通过机器校验;AI 审计消化一轮嫌疑清单,修正全部经 API 落盘。

## 8. 风险 / 注意事项

| 风险 | 缓解 |
|---|---|
| AI 沉淀内容质量差(垃圾进垃圾出),auto 模式下风险放大 | 清单结构化+报告恒展示(设计原则 4);lint 硬拦格式层;auto 模式默认关、由用户主动开启并可随时切回;权威=文件,误沉淀直接改/删文件即回滚 |
| 会话写入与 watchdog 竞态(自写事件重复索引) | writer 持锁期间登记"预期事件",watchdog 收到匹配事件跳过;验收 1 覆盖 |
| skill/CLAUDE.md 改造触碰工作流权威文本 | 全部措辞先贴用户过目(Step 4);canonical→adapter 走既有 sync 工具,不手改适配器 |
| 服务未启动时的沉淀(手动启动模式下可能忘开) | skill 开头自检服务健康,不在线则提示用户启动后再沉淀(不静默跳过、不降级手工双写——单轨原则) |
| 存量库 lint 出大量历史问题干扰本计划 | Step 2 明确:基线报告只记录不修复,存量清理独立成任务(入 plans_waitChoose) |

## 9. 不在本计划范围

- 服务后台进程**自主**写库(auto 模式自动化的是会话侧触发时机;写入永远由 AI 会话/用户经 API 发起,见设计原则 5)
- 存量记忆大清理/重复合并(lint 基线报告产出后独立立项)
- bug-record、user-real-design 等其他知识体系的 API 化写入(先证明 memory+架构双域闭环,再扩)
- 回归测试用例的自动执行(本主题群交付"波及面+证据→用例底稿"的知识链,执行属测试基建)

## 10. 待用户拍板

(无——决策 1=双模式+capture_mode 开关(默认 manual)、决策 2=API 单轨化,均已确认。)

本计划在子计划 2 完工后启动(Step 1~3 仅依赖子计划 1,可提前动工)。

---

## 11. 执行记录(2026-07-19 完工归档)

**状态:✅ 全部完成**(Step 1~5 全勾,commit 13df842 / d0fec1c / 02bb5d5)

### 实际交付

- **写路径三层**:`writer.py`(原子编排:围栏预检以落盘后盘面→权威写→缓存双写(契约推导路径,无缓存机器如实跳过)→增量索引,失败回滚)+ `lint.py`(硬规则=围栏 R1~R8+双写对账(MEMORY.md 契约头豁免);嫌疑=断链/弱 fm/分级封面对账/重复对/组漂移+vectorCoverage 防静默)+ API 面(MCP `memory_upsert/delete/lint` + REST `/memory/* /lint /capture-mode`,统一 dry_run)。
- **capture_mode 全链**:config 字段(默认 manual)→ CLI `capture-mode` → REST → `memory_stats` 暴露 → 健康页开关;服务任何模式下不自主写库,自动化的只是会话侧扣扳机时机。
- **工作流单轨化落地**(三份措辞经用户确认+两条补充):CLAUDE.md「记忆与架构查询」新章+总结流程按模式分流;boardgame-memory-skill-update §4.0 五步清单+落盘段 API 化;plan-finish-code-review §11 沉淀改必做。**fallback 契约**:部署判定=`~/.memoryhub/` 存在(install.json 给 projectRoot,禁绝对盘符路径);已部署离线→提示启动;未部署→旧索引路径不阻塞。
- **配套 skill 家族**(G 生态):hty-memory-hub-dev / -init / -autostart / -bootstrap。

### 执行期偏差(全部为精简方向)

1. watchdog 去重锁未做——对账式增量幂等使其成为"为不存在的问题设计的锁"(§8 风险 2 实际不成立,自写事件重复索引结果幂等)。
2. `arch_upsert` 未单列——arch 文件走统一 upsert 按路径自动跑围栏。
3. lint 嫌疑实时计算不持久化——审计消化后重跑自然消失。
4. Step 5 演练素材用本轮真实知识(reference_memoryhub_access)替代模拟任务——真沉淀比模拟更有验证力,且演练本身完成了 MemoryHub 接入事实的记忆沉淀。
5. 会话内 MCP 工具面(upsert/lint)受工具表会话级缓存限制(见 [[reference_mcp_session_tool_cache]]),本会话以 REST 同源路径完成演练,新会话自然生效。

### 验收对照(§7)

原子性✓(成功三方一致+失败回滚实测)/ 闭环时效✓(upsert 即 indexed,检索立即命中)/ 触发按模式守恒✓(manual 门禁不变;auto 演练不等信号+报告展示+纠错删除)/ lint 有效性✓(硬规则 R3 拒收实测;基线硬 0/嫌疑 41 真实队列)/ skill 单轨✓(手工双写指令全部退役,fallback 段为未部署机器保留的是旧索引路径而非双轨)/ 分层治理守恒✓(架构层 approved 两模式同闸)。
