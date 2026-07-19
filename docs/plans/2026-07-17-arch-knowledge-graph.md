# MemoryHub 子计划 2:架构知识图谱与影响面分析

**日期**:2026-07-17
**任务类型**:需求实现
**状态**:决策 1 已确认(A + 记忆优先级层级要求);决策 2 用户未表态、按推荐 A 待执行(异议随时提出);待执行令
**前置依赖**:[子计划 1(检索核心)](./2026-07-17-memory-vector-db-service.md) 的服务骨架、SQLite 库(schema_version 迁移)、scanner/store
**所属主题群**:[global-plan-manager.md](./global-plan-manager.md)

---

## 1. 目标

在检索核心之上建立**结构化架构知识层**:项目有多少模块、全局设计、模块间关系、每个模块的需求细节与逻辑细节——用户经前端(子计划 3)看清,AI 经 `arch_overview / arch_module / arch_impact` 接口一次拿全。核心能力是**影响面查询**:给定"要改的模块/功能",沿类型化关系边返回波及集合+理由+历史回归证据,作为 AI 设计**完整回归测试用例**的数据底座(修 bug / 加功能同理)。

## 2. 背景(现状资产盘点)

### 2.1 已有的关系数据(可作图谱种子,均已实证)

- **382 记忆文件的 `[[wiki链]]`**:弱关系(相关),无类型无方向——可导入为 `related` 边,但撑不起影响面分析。
- **12 组分类**(index_0~11):项目域级分组,与"模块"高度相关但≠模块(如 network 组混着 StateSync/IGP/Mirror 多个系统)。
- **回归热点地图** `index_0_set_core/reference_regression_hotspot_map.md`:10 个热点簇、每簇挂 bug-record——现成的"改这里容易回归那里"知识,直接转 `affects` 边种子。
- **bug-record 体系**(board-game-editor-bugrecord skill 产出):历史回归案例,可反演验证影响面查全率。
- **CLAUDE.md 变更契约门禁**:已强制"改共享符号前用 Jet 反扫爆炸半径"——那是**代码级**当场分析;本计划补的是**知识级**沉淀(跨会话复用、功能语义粒度),两层互补而非替代。

### 2.2 缺口(为什么现状不够)

- 无结构化模块清单:「项目有多少模块」目前只存在于 CLAUDE.md 架构段落与各封面索引的散文里,AI 每次要自己拼。
- 关系无类型无方向:`[[链]]` 分不清"A 依赖 B"还是"改 B 会打坏 A",无法机器遍历出波及面。
- 需求细节/逻辑细节散落:project/feedback 记忆各自成文,没有按模块聚合的规整视图。

## 3. 决策点

### 决策 1:图谱权威载体 —— **已确认 A(2026-07-17 三轮),并追加记忆优先级层级要求**

用户拍板:图谱进记忆库新组 `index_12_architecture/`(一模块一 md,frontmatter 结构化+正文自由,复用双写/索引/维护全管线),且明确**图谱结构属于重要记忆,在记忆体系中的优先级层级为**:

> **第一:最高规则(铁律)→ 第二:图谱结构(架构总览)→ 第三:各结构内的系统内部细节记忆。**

落地方式(§4.1a 优先级层级设计):

1. **MEMORY.md 结构调整**:「最高铁律」段(第一)之后**新增「架构图谱」段(第二)**——index_12 组入口 + 一句使用姿势("理解项目/评估改动先 `arch_overview` 看全局形势与影响面,再进组细节");原 11 组「记忆地图」顺延为第三层(系统内部细节)。
2. **AI 加载与使用顺序**:会话理解项目的标准姿势 = 铁律 → 架构总览(arch_overview)→ 按需下钻细节;落在 CLAUDE.md 与子计划 1 Step 7 检索条款同一位置——子计划 1 执行时先落"检索优先"句,本计划 Step 3 执行时在同条款处**追加**加载姿势句(两次落笔、一个条款,避免两处规则漂移)。
3. **封面链**:`index_12_architecture/index_0_architecture.md` 组封面同构,组内按 layer 列模块清单。
4. **检索呈现**:memory_search 结果中架构组文件带 `module/架构` 标识,便于 AI 识别"这是第二层结构件而非第三层细节"。

### 决策 2:存量策展方式(冷启动 382 文件 → 图谱)——用户未表态,**按推荐 A 待执行**(异议随时提出)

> 人审定位(按四轮分层治理原则):用户审的是**架构层**——模块清单、划分、命名、layer(Step 2 闸门)与抽审模块文件的 **relations 方向/理由**(Step 3 闸门);features 细节与 memory_refs 挂接的正确性不依赖人工逐条看,由 §4.2 机器围栏 + **AI 交叉核对**(起草会话之外另起独立会话按模块抽核 memory_refs 归属与 requirement/logic 是否忠于原记忆,双 AI 独立视角防单会话幻觉)保障。

| 选项 | 含义 | 影响 |
|---|---|---|
| **A** | **AI 分组起草 + 用户分批审核**:AI 从 12 组封面/热点地图/CLAUDE.md/记忆正文起草模块清单(预估 15~25 个)与每模块文件,用户先审清单、再逐组抽审 2~3 个模块文件定稿 | 人工量可控(审代替写);AI 起草会有错漏,靠抽审+子计划 4 的持续沉淀收敛;策展分 Step 推进,每批都有用户闸门 |
| **B** | 全人工撰写模块文件 | 质量上限高,但 15~25 个模块×逐文件人工,现实中大概率烂尾 |

**推荐**:**A**——图谱价值在"持续维护下逐步收敛",不在首日完美;用户闸门保方向,沉淀闭环保精度。

## 4. 设计原则

1. **权威=md 文件,库=派生索引**(沿子计划 1 原则):modules/relations 表可随时从 `index_12_architecture/` 全量重建。
2. **关系必须类型化+有向+带理由**:`depends_on`(A 用到 B 的机制)/ `affects`(改 A 波及 B)/ `shares_state`(共享单例/数据/事件)/ `extends`(扩展点挂接)/ `related`(弱关联,`[[链]]` 迁移来);每条边必填 `reason` 一句话——没有理由的边在影响面报告里无法向用户解释,禁止入库。
3. **两级粒度渐进**:Module 级边先行(冷启动即可用),Feature 级边随沉淀闭环(子计划 4)逐步加密;`arch_impact` 对两级统一遍历。
3a. **关系形态四分类**(用户五轮补充:"哪些系统并行、哪些深度、哪些横向、哪些纵向,常规代码扩展架构都要考虑到")——图谱必须能表达项目代码的真实组织形态:
   - **纵向(深度)**:跨 layer 的 depends_on 链(UI→业务→引擎→L0 原子/数据),呈现为分层堆叠与依赖深径;
   - **并行**:同 layer 且无互边的兄弟系统(如本地化 ∥ Telemetry),呈现为同泳道并列;
   - **横向(扩展族)**:**模块内扩展点下的并列实现集**——如 UIDisplay 系统的 BasicDisplay 基类下 N 个 Display 子类、蓝图节点注册表下 N 个 NodeBehaviour、Mod 行为反射注册下 N 个卡牌类。扩展点(anchor=基类/接口/注册表)+实现清单建成 schema 一等公民(§4.1 `extension_points` 字段);
   - **扩展点 ↔ 变更契约衔接**:CLAUDE.md 变更契约的 Additive 判定要求"写明插入哪个扩展点"——图谱的扩展点目录就是其机器可查依据(`arch_module` 返回扩展点清单;AI 做变更契约时先查扩展点,插得进=Additive,插不进=登记**扩展点缺口候选**,喂给既有的"扩展点审计"机制)。
4. **诚实边界**:图谱是**已沉淀知识**,代码才是 ground truth——`arch_impact` 结果标注"知识级波及,须配合 Jet 代码反扫互补"(变更契约第 3 项的两层证据之一,不替代它)。
5. 模块划分语言沿用项目既有分层词汇(L0 数据模型 / L1 接口 / L2.5 Ops / 门面 / Display / Mod / 蓝图…),不发明新术语。
6. **记忆优先级层级**(用户 2026-07-17 明确):铁律第一、图谱结构第二、系统内部细节第三——体现在 MEMORY.md 段落顺序、AI 使用姿势条款与检索呈现(详见决策 1 落地四项);图谱组是"第二层结构件",不与第三层细节记忆混排。
7. **分层治理界定**(用户四轮:"记忆庞大后人工只看架构和分组,细节由 AI 看")——**架构层** = 模块的增/删/改名/合并拆分、layer 划分、关系类型枚举、组结构、MEMORY.md 三层骨架,变更必须贴用户批准;**细节层** = feature 增改、边增改、memory_refs 挂接,由机器规则硬拦(§4.2)+ AI 自查保障,不假设用户逐条过目。AI 找不到合适模块挂接时=**架构缺口**,上报用户裁决,禁止自创模块(呼应 CLAUDE.md「扩展点缺口回填」同款机制)。

### 4.2 细节层机器围栏(arch lint 硬规则,全部可程序判定)

用户不看细节 → 细节合规必须机器兜住。以下规则违反即拒绝入库(写入 API 与 lint 共用同一套校验):

| # | 规则 | 拦截目标 |
|---|---|---|
| 1 | 边的 target 模块/feature 必须已存在 | AI 幻觉引用不存在的节点 |
| 2 | 边必填 type(枚举内)+ reason 非空 | 无法解释的边混入影响面报告 |
| 3 | feature 必须挂在已有 module 下;新 module 文件入库前置校验"用户批准标记"(frontmatter `approved: <日期>`,由架构层流程写入) | AI 绕过审批自创模块 |
| 4 | memory_refs 引用的记忆文件必须存在;`[[链]]` 断链报警 | 引用腐化 |
| 5 | frontmatter schema 校验(字段名/类型/枚举值),未知字段拒收 | 结构漂移 |
| 6 | 归组一致性:index_12 组内只允许模块文件与组封面,普通记忆禁入;普通记忆禁带 relations 字段 | 层级混排 |
| 7 | 分类漂移嫌疑(警告级不阻断):新记忆向量与所挂组/模块质心相似度显著低于组内均值 → 进嫌疑清单待 AI 审计 | 放错组的细节记忆 |
| 8 | extension_points 校验:kind 在枚举内、anchor 非空、implementations 名非空且不跨模块重复;同 anchor 禁在多模块重复声明 | 扩展点目录腐化,Additive 判定失锚 |

### 4.1 模块文件 schema(`index_12_architecture/module_<slug>.md`)

```markdown
---
name: module-statesync            # slug,主键
title: StateSync 状态同步
summary: 一句话职责
layer: 网络/同步                   # 项目既有分层语言
key_assets: [Assets/Scripts/..., 程序集名]   # 关键代码落点(可选)
features:                          # 功能单元列表
  - id: flip-face-state
    title: 卡堆翻牌权威面状态
    requirement: <需求细节:用户视角行为约定>
    logic: <逻辑细节:实现要点/不变量>
    memory_refs: [project_cardpile_flip_authoritative_face_state]   # 回链既有记忆
extension_points:                  # 横向扩展点(系统内并列实现族;无则空数组)
  - id: sync-field-handlers
    title: 同步字段类型处理器
    kind: reflection-registry      # 枚举:base-class(继承) / interface / reflection-registry / config-registry
    anchor: SyncFieldHandler<T>    # 基类/接口/注册表符号名(变更契约 Additive 判定的锚)
    additive_note: 新增类型继承 anchor 即自动注册,不改任何已有文件
    implementations:               # 横向并列实现清单(name + 可选 memory_refs)
      - { name: IntFieldHandler }
      - { name: CardRefFieldHandler, memory_refs: [project_card_instance_identity] }
relations:                         # 对外边(module 级必填,feature 级可选 from_feature)
  - type: affects
    target: module-handcard-container
    reason: 翻牌状态变更经手牌容器展示,改同步时序会打坏选牌高亮
    evidence: [BUG-090]            # 可选:bug-record/热点簇引用
---
正文:全局设计叙述、时序图、演进史等自由内容(向量索引照常覆盖)
```

## 5. 文件清单

### 5.1 新增

| 路径 | 职责 |
|---|---|
| `.htyworkflows/memory/index_12_architecture/index_0_architecture.md` | 第 13 组封面索引(组内模块清单),MEMORY.md 同步登记(决策 1=A 时) |
| `.htyworkflows/memory/index_12_architecture/module_*.md` | 15~25 个模块文件(策展产出,双写 Claude 缓存) |
| `HtyMemoryHub/src/memoryhub/arch.py` | 模块文件解析(frontmatter 校验)、modules/relations 表、影响面遍历(BFS+去环+depth 限制) |

### 5.2 修改

| 路径 | 改动概要 |
|---|---|
| `HtyMemoryHub/src/memoryhub/scanner.py` | 识别 `index_12_architecture/` 走 arch 解析分支;`[[链]]` 全量提取入 related 边 |
| `HtyMemoryHub/src/memoryhub/store.py` | schema_version v2:modules/features/relations 表;memory_search 结果附所属 module 字段 |
| `HtyMemoryHub/src/memoryhub/server.py` | 新增 MCP 工具+REST:`arch_overview` / `arch_module` / `arch_impact`(REST: /arch/overview /arch/module/{name} /arch/impact) |
| `HtyMemoryHub/src/memoryhub/cli.py` | `arch lint`(schema 校验/断链边/孤儿模块)、`arch impact <target>` 命令行入口 |
| `MEMORY.md` | **结构性调整**:「最高铁律」之后新增第二层「架构图谱」段(index_12 入口+使用姿势),原 11 组地图顺延为第三层;双写 Claude 缓存 |

### 5.3 删除

| 路径 | 原因 |
|---|---|
| (无) | 热点地图/既有记忆保持原位,只被引用不被迁移 |

## 6. 实施步骤

### Step 1 — schema 定稿与解析/存储层
- [ ] 模块文件模板+关系类型枚举定稿(§4.1);arch.py 解析+校验(缺 reason 的边报错拒收)
- [ ] store v2 迁移:modules/features/relations 表;`[[链]]` 批量导入 related 边
- **验证**:手写 2 个样例模块文件,`arch lint` 通过;故意写断链 target/缺 reason 边被拒并给可读报错

### Step 2 — 模块清单策展(用户闸门 1)
- [x] AI 通读 12 组封面+CLAUDE.md 架构段+热点地图,起草模块清单(name/title/summary/layer/组映射),预估 15~25 个
- [x] **清单全文贴给用户审**:增删改模块划分、命名,拍板后冻结为策展基线
- **验证**:✅ 2026-07-19 用户确认冻结。**基线 = 24 模块四层**(基础5:foundation_arch/atom_ops/entity_id_index/framework_singleton/ext_neutralization;引擎5:statesync/network_session/blueprint_engine/mod_engine/session_lifecycle;业务9:cardpile/handcard/card_transition/display_binding/presentation/buff/frame_animation/gameend/legion;UI5:customui_layout/editor_shell/editor_persistence/localization/telemetry_sdk[薄])+ **四类记忆归宿**(挂模块~250 / 横切·铁律~55 / 横切·环境工具链~38 / 组织文件~15,358 条零盲区)。经三轮检查:全量覆盖审查(修订1-3:四类归宿声明/#15并交互指示/#4补日志通道)→ App 迁移适配(修订4:#9 去 ModForge、#24 转 telemetry_sdk 薄模块,364→358 六删全对账)→ 外部 AI 工作复核(无新增影响);热点地图双写脱同步顺带补回权威库

### Step 3 — 逐组起草模块文件(用户闸门 2)
- [ ] 按组推进:AI 起草各模块 md(features 从该组 project/feedback 记忆归纳,memory_refs 回链;热点地图 10 簇转 affects 边+evidence)
- [ ] **扩展点识别**:每模块用 Jet 搜 `": 基类名"` / 接口实现 / 反射注册表(CLAUDE.md 既有查继承法)盘出扩展点与实现族,填 `extension_points`(anchor 以代码实查为准,禁凭记忆写)
- [ ] 每组起草后:**独立 AI 会话交叉核对**(非起草会话)——逐模块核 memory_refs 归属正确、requirement/logic 忠于原记忆原文、边方向与 reason 自洽,产出核对差异表,差异归零后才提交用户
- [ ] 每完成一组:用户抽审 2~3 个模块文件(**只聚焦架构层**:relations 方向/reason、模块划分;features 细节已由机器围栏+交叉核对兜住)
- [x] 定稿后双写 Claude 缓存,增量索引
- [x] **MEMORY.md 结构性调整**(决策 1 落地项 1):新增第二层「架构图谱」段+组封面建立,调整稿先贴用户过目再落盘(MEMORY.md 是每会话常驻入口,属高敏文件)
- **验证**:✅ 2026-07-19 全链完成——5 批起草 agent(150 features/105 边/38 扩展点全代码实锚:FrameworkApp 55/节点注册 360/BasicDisplay 34/LegionCardBase 31+TianzaiCardBase 16/Drawer 33 等)→ 双独立会话交叉核对(A:边 46/46+anchor 20/21;B:边 59/59+三大族计数精确吻合)→ 9 处差异修正归零 → `arch lint` 真库全绿 → 25 文件入库权威+缓存双写(383 docs,向量 28 chunks)→ MEMORY.md 三层结构双写落盘;用户"继续"放行(抽审入口已给:statesync/legion/display_binding);热点 10 簇转 affects 边(17 处 BUG evidence);顺带产出"记忆↔代码张力"素材(音频同步单元/卡堆布局缺记/DebugCfgCoreApp 失踪)供 plan-4 审计队列

### Step 4 — 架构查询 API
- [x] `arch_overview()`:模块清单+summary+按 layer 分组(纵向)+边统计+各模块扩展点计数(AI 一次调用拿全局形势:分层/并行/横向扩展全貌,预算 <2K token)
- [x] `arch_module(name, include_features=true)`:单模块全量细节,含 `extension_points`(扩展点+实现族——变更契约 Additive 判定的机器可查依据)
- [x] `arch_impact(target, depth=2, edge_types=...)`:反向 BFS 波及集合,按跳数分层,每项带 reason 链+evidence(遍历语义:affects 出边/depends_on 入边/shares_state 双向/extends 入边;related 需显式指定)
- **验证**:✅ 2026-07-19——MCP(六工具在线)与 REST(/arch/overview /module /impact)双通道调通;`arch_impact(module_statesync)` 11 项两跳波及与热点簇 A(最大热区)人工比对一致,每项带 BUG evidence;`arch_module(module_display_binding)` 三扩展点 anchor 与交叉核对实查一致(BasicDisplay 族 34 计数在 note);commit 已推 GitHub

### Step 5 — 影响面质量反演验收(用户闸门 3)
- [x] 从 bug-record 挑 5 个"当年实际引发过跨模块回归"的案例,对每个案例问 `arch_impact`:当年真实波及的功能是否落在返回集合内
- [x] 未覆盖的 → 补边(记录进策展修正批次),复测
- **验证**:✅ 2026-07-19——首轮 3/5(BUG-054/090/121 覆盖;BUG-075 shell→persistence 缺正向边、BUG-115 card_transition 零出边孤点未覆盖)→ **补 3 边**(card_transition affects cardpile/handcard[BUG-115]、editor_shell affects editor_persistence[BUG-075])+ handcard→legion 补 BUG-090 第二契约证据 → **复测 5/5**,lint 全绿(边 105→108);反演机制本身即"图谱随真实回归收敛"的实证;顺带补齐 5.2 遗留项 memory_search 附 modules 字段(CLI ⊂ 标签);另记待议项:editor_shell→statesync 弹窗边源模块疑更贴 customui_layout(核对 B 曾验 reason 相符,保留待后续人工复核);commit a0315d8

## 7. 测试验证(整体验收)

1. `arch lint` 全库零报错;modules/relations 表可删库后从 md 全量重建且行数一致。
2. `arch_overview` 输出与模块清单基线一致;AI 新会话冷启动,单次调用即可写出正确的项目模块拓扑描述(人工核)。
3. `arch_impact` 热点簇比对(Step 4)+ bug-record 5 案例反演(Step 5)达标。
4. memory_search 混合检索结果正确附带所属 module;按 module 过滤有效。
5. 模块 md 手改一处 relations → watchdog 增量后 `arch_impact` 立即反映新边。

## 8. 风险 / 注意事项

| 风险 | 缓解 |
|---|---|
| AI 起草的边方向/理由错误 → 影响面误导 | 每条边强制 reason+独立 AI 会话交叉核对+用户架构层抽审;evidence 挂 bug-record 的边优先可信;错边随子计划 4 沉淀闭环持续修正 |
| 库庞大后细节腐化无人发现(用户只看架构层) | §4.2 机器围栏拦格式与引用层;分类漂移/重复嫌疑进 lint 嫌疑清单,由子计划 4 的 AI 审计流程周期消化 |
| 图谱查全率有限,用户误当"完整影响面" | API 返回与前端展示均标注"知识级波及,须配合代码级 Jet 反扫"(设计原则 4);变更契约仍是硬门禁 |
| 模块划分颗粒度争议(太粗没用/太细维护不动) | Step 2 用户闸门先冻结清单;粒度基线=「一个可独立描述职责的系统」,feature 承接细粒度 |
| 策展周期长、烂尾 | 分组推进,每组独立可用;先 module 级边(即刻可查),feature 级渐进 |
| 新组 index_12 与既有 MEMORY.md 索引体系冲突 | 纯增一组+封面登记,组织结构不动;boardgame-memory-skill-update 的封面链维护规则天然覆盖新组 |

## 9. 不在本计划范围

- 图谱/记忆的**写入 API 与沉淀时自动建边** → [子计划 4](./2026-07-17-memory-write-lifecycle.md)
- 关系图**可视化** → [子计划 3](./2026-07-17-web-dashboard.md)
- 代码级依赖自动提取(asmdef/using 静态分析自动生成边)——初版边来自知识策展;代码级自动补边留作后续增强(记入 manager 经验区再议)
- 回归测试用例的**生成本体**(那是 AI 会话拿 arch_impact 数据后的推理产出,非数据库职责;工作流条款在子计划 4)

## 10. 待用户拍板

(决策 1 已确认 A+优先级层级;决策 2 未表态、默认按推荐 A 执行——**若希望改为全人工撰写请在执行前提出**。)

本计划在子计划 1 完工后启动。

## 11. 执行记录

**执行日期**:2026-07-19
**执行模式**:AI 自动执行(plan-auto-execute)+ 三处用户闸门(清单三轮审定 / "继续"放行 / 反演结果过目)

### 11.1 决策汇总
| 决策点 | 结果 | 关键理由 |
|---|---|---|
| 决策 1 图谱载体 | A(memory 新组 index_12)+ 三层优先级落 MEMORY.md | 用户拍板;复用双写/索引全管线 |
| 决策 2 存量策展 | A(AI 起草+审核),执行形态=5 并行起草 agent + 2 独立交叉核对 agent | 用户默认放行;双盲核对代偿"用户不看细节" |

### 11.2 实际改动
| 位置 | 概要 | Step |
|---|---|---|
| `HtyMemoryHub/` arch.py/store v3/scanner/cli/server | 解析+八围栏+派生表+overview/module/impact API+检索附 modules(commits 4ce347d→a0315d8) | 1/4/5 |
| BGE `.htyworkflows/memory/index_12_architecture/` | 25 文件(24 模块+组封面)双写缓存;反演补 3 边+1 证据 | 3/5 |
| BGE 两处 MEMORY.md | 三层结构(铁律→图谱→细节)双写 | 3 |

### 11.3 验证结果(对照第 7 段)
- [x] 1 lint 全库零报错;派生表 reindex 全量重建一致
- [x] 2 arch_overview 与基线一致(24/四层);MCP 会话内实测六工具在线
- [x] 3 热点簇比对(statesync 11 项两跳吻合簇 A)+ 5 案例反演(3/5→补边→5/5)
- [x] 4 memory_search 附 modules 归属;按 module 过滤经 group 与 modules 字段可用
- [x] 5 模块 md 手改边 → watchdog 增量 → impact 立即反映(补边过程实证)

### 11.4 偏离计划之处
| 项 | 计划设想 | 实际 | 原因 |
|---|---|---|---|
| 策展节奏 | 逐组推进+每组用户抽审 | 5 批并行起草+双独立核对+一次性入库,用户"继续"整体放行 | 用户四轮确立"人管架构,AI+机器管细节",双盲核对+围栏代偿逐组人审 |
| 用户抽审(闸门 2) | 每组抽 2~3 文件 | 抽审入口给出(statesync/legion/display_binding),用户放行未逐个看 | 同上;relations 经核对 B 59/59 全验 |

### 11.5 后续工作
- editor_shell→statesync 弹窗边源模块归属复核(待议项,不阻塞)
- "记忆↔代码张力"素材移交 plan-4 审计队列:音频同步单元 vs 记忆口径、卡堆布局 DiscreteScatter/Grid 缺记、DebugCfgCoreApp 失踪、Ext 计数 28→31 演进
- feature 级边随 plan-4 沉淀闭环渐进加密(现以 module 级为主)

### 11.6 触发的新风险 / 已知技术债
- (无新增;反演机制已实证"缺边→补边→收敛"闭环成立)
