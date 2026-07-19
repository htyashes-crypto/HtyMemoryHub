# MemoryHub 子计划 3:可视化前端(架构总览/影响面/检索)

**日期**:2026-07-17
**任务类型**:需求实现
**状态**:技术栈已确认(HtyBox 同款轻量栈);**视觉基准已定稿**(2026-07-17 用户确认 mockup:"就这一版")。待执行令
**视觉验收基准**:`.htyworkflows/svg/memoryhub/` 六张定稿 mockup——overview(焦点模式泳道图)/ module-detail / impact-analysis / memory-search / library-health / overview-dark(配色参考;实现为同一布局的 CSS token 双主题切换,深色不单独设计布局)。实现页面与 mockup 的布局、分区、边编码、焦点交互对齐,像素级微差可接受,结构性偏离须回到 mockup 层重新对齐
**前置依赖**:[子计划 1](./2026-07-17-memory-vector-db-service.md) 的 REST 服务 + [子计划 2](./2026-07-17-arch-knowledge-graph.md) 的 arch API(可与[子计划 4](./2026-07-17-memory-write-lifecycle.md) 并行)
**所属主题群**:[global-plan-manager.md](./global-plan-manager.md)

---

## 1. 目标

给**用户**一个浏览器页面(服务内嵌,`http://127.0.0.1:61397/ui`),看清项目完整架构:有多少模块、全局设计、模块间关系图、每个模块的需求细节与逻辑细节;并可视化影响面分析(选中要改的东西 → 高亮波及面 → 一键导出回归清单底稿)与记忆检索。与 AI 走的 MCP/REST 同一数据源,双端视图一致——满足"分别考虑给用户/AI 的双重需求"。

## 2. 背景

- 数据与接口全部由子计划 1/2 提供(REST:/search /doc /stats /arch/*),前端是**纯消费端**,不引入新数据源、不做写入(编辑走文件与子计划 4 的 AI 流程)。
- **技术栈参照 `G:\hty_workflows\HtyBox`(用户指定,2026-07-17 实测其 package.json)**:React 19 + TypeScript 5.8 + Vite 7 + Tailwind 4(`@tailwindcss/vite` 插件,零配置文件)+ `@icon-park/react` 图标 + `marked` 渲 markdown;**无全局状态库**(无 Zustand/Redux,React state/context 即可)——"轻量"的实质。HtyBox 的 Tauri 壳/xterm/dockview 属桌面应用件,本场景(服务内嵌网页)不需要。
- 可移植约束(主题群既定):目标机可能无 Node——因此**构建产物 dist 随仓库提交**,运行期由 uvicorn 静态托管,零 Node 依赖;仅改前端时才需要 Node 环境。CSP 同理:所有资源本地打包,不依赖 CDN。

## 3. 决策点

### 决策 1:前端技术栈 —— **已确认(2026-07-17 三轮):HtyBox 同款轻量栈**

| 项 | 选定 | 说明 |
|---|---|---|
| 框架 | React 19 + TS + Vite 7 | 与 HtyBox 完全一致,pnpm 管理 |
| 样式 | Tailwind 4(`@tailwindcss/vite`) | 零配置文件方式,同 HtyBox |
| 状态 | React state/context,**不引入状态库** | 五视图数据流简单(拉取-展示),轻量原则 |
| 图标/MD | `@icon-park/react` + `marked` | 同 HtyBox |
| 关系图 | `echarts/core` **按需引入**(仅 GraphChart+力导,tree-shake 后 ~400KB) | HtyBox 无图可视化件,此为唯一补充;按需引入守轻量约束 |

## 4. 设计原则

1. **只读消费端**:前端零写入口(唯一例外:触发 POST /reindex 的"重建索引"按钮);数据编辑永远走 md 文件/AI 流程,不做网页编辑器——避免与"权威=文件"原则打架。
2. **双端一致**:页面展示的每块数据都来自 AI 同款 REST 接口,不做前端专属聚合逻辑(聚合缺什么就加到后端接口,让 AI 同步受益)。
3. **影响面即回归底稿**:影响面视图的终点是"导出 markdown 回归清单"(波及功能+理由+evidence),用户直接贴进测试计划/交给 AI 展开用例。
4. 界面简体中文;主题跟随 HtyBox 双主题(默认奶油浅色 + 可切暖棕深色,最终以 mockup 定稿为准);单页应用内路由,五视图侧边栏切换。
5. **关系边线型+箭头形状双编码**(用户 mockup review 反馈,禁退化为纯颜色区分):纵向依赖=实线+实心三角、影响=长虚线+空心三角、共享状态=点线+菱形、相关=细虚线无箭头;色弱/快速扫读下三形态仍可辨,图例展示线样+箭头实形。
6. **边渲染规模化策略**(用户 mockup review 反馈:"数据量大时连线混乱无法阅读"——硬约束,五条缺一不可):
   - ① 默认态 = **骨架模式**:只渲染纵向 depends_on 边,影响/共享状态默认关(图例胶囊即开关);
   - ② **焦点模式**:点选任一模块 → 仅渲染该模块全部进出边(全类型),无关节点淡化(opacity ≈0.3),再点空白/✕ 退出——大规模下的主阅读方式,单次可见边=该模块度数;
   - ③ **正交通道路由**:泳道布局下边走道间水平通道+垂直落位的圆角折线,同通道多边平行错开,禁斜穿节点(ECharts graph 自带布局不满足时,泳道模式自绘 SVG/canvas 边层);
   - ④ **聚合边**:同一对模块间多条同类型边合并为一条+计数徽章,点击展开明细;
   - ⑤ hover 边浮层显示 reason/evidence。
   验收模拟:造 50 模块/200 边测试数据,骨架与焦点模式下均无边穿节点、无不可辨交叉。

## 5. 文件清单

### 5.1 新增

| 路径 | 职责 |
|---|---|
| `HtyMemoryHub/webui/`(package.json / vite.config / src/) | React 19+TS 源码:五视图 + api.ts 封装层(状态用 React context,无状态库;pnpm 管理,同 HtyBox) |
| `HtyMemoryHub/webui/dist/`(构建产物,入库) | 运行期静态资源,uvicorn 托管,目标机零 Node |
| `HtyMemoryHub/webui/src/views/OverviewView.tsx` | 视图①架构总览:模块统计卡 + 全局架构图**双模式**——分层泳道(默认:layer 泳道呈现纵向依赖/同道并列=并行系统,节点带 ⊞ 扩展族徽章可展开横向实现清单)/ 力导(ECharts graph);边类型着色/过滤,点击节点进详情 |
| `HtyMemoryHub/webui/src/views/ModuleView.tsx` | 视图②模块详情:职责/分层/关键资产/features(需求细节+逻辑细节折叠面板)/**扩展点区块**(anchor+kind+横向实现族+Additive 提示)/进出边/关联记忆跳转 |
| `HtyMemoryHub/webui/src/views/ImpactView.tsx` | 视图③影响面:选目标+depth → 波及子图高亮+分层列表(reason/evidence)→ 导出回归清单 md |
| `HtyMemoryHub/webui/src/views/SearchView.tsx` | 视图④记忆检索:hybrid/keyword/vector 切换、组与模块过滤、结果列表、md 全文渲染预览 |
| `HtyMemoryHub/webui/src/views/HealthView.tsx` | 视图⑤库健康:索引状态/文档与向量统计/**lint 分层报告**(架构层问题高亮置顶=需人裁决;细节层硬拦记录与嫌疑清单=AI 审计队列)/重建索引按钮 |

### 5.2 修改

| 路径 | 改动概要 |
|---|---|
| `HtyMemoryHub/src/memoryhub/server.py` | 挂载 /ui 静态目录;补前端需要的聚合接口(如 /arch/graph 一次拿全图节点边) |
| `HtyMemoryHub/README.md` | 增"前端开发/构建"章节(仅改前端需 Node;`npm run build` 后产物入库) |

### 5.3 删除

| 路径 | 原因 |
|---|---|
| (无) | (无) |

## 6. 实施步骤

### Step 1 — 脚手架与 API 层
- [x] pnpm + Vite 7 + React 19 + TS 初始化(对照 HtyBox 的 package.json/vite.config 起步);Tailwind 4 via `@tailwindcss/vite`;echarts/core 按需注册;api.ts 封装全部 REST;布局壳+侧边栏路由(双主题切换,奶油默认)
- ✅ 2026-07-19:双主题 token 全套、api.ts 全接口、App 壳(顶栏状态/五导航/记忆层级块);另补后端聚合口 /arch/graph(全图)与 /arch/lint(围栏报告);首次 build 过;commit a566d35

### Step 2 — 视图①架构总览 + 视图②模块详情
- [x] 总览:模块卡片墙(按 layer 分组统计)+ 全局架构图双模式(默认**分层泳道**:layer 泳道 × 纵向 depends_on 跨道边 × ⊞ 扩展族徽章展开;可切**力导**);边类型图例与过滤、节点点击跳详情
- [x] 详情:frontmatter 全字段渲染、features 折叠面板(requirement/logic)、扩展点区块(anchor/kind/实现族/Additive 提示)、进出边表、memory_refs 点击 → 检索视图预览该记忆全文
- **验证**:✅ 2026-07-19(agent A 产出,build/oxlint 全绿)——泳道 SVG 自绘(四层正交折线/同通道错开/6px 圆角),边线型+箭头双编码全按原则 5,焦点模式(单击聚焦/淡化 .3/双击进详情/图例即过滤),力导 echarts 按需引入+主题热切换;详情页 features 折叠/扩展点区块/进出边可跳转;24 模块/108 边真实数据接线;**规模模拟**:50 模块/200 边模拟工作区(61399 实例)graph 接口返回正确、围栏全绿,焦点模式可见边=度数为结构性保证,浏览器可读性随用户走查确认

### Step 3 — 视图③影响面分析
- [x] 目标选择器 + depth(1/2/3 胶囊,执行期以胶囊代滑杆)→ 调 /arch/impact → 放射子图(跳数渐淡+类型线型)+分跳清单(每项 reason+evidence 徽标,模块可点跳详情)
- [x] "导出回归清单":生成 markdown(波及功能×检查要点×历史证据)复制剪贴板;另有"复制给 AI 会话"带引导句版本
- **验证**:✅ 2026-07-19(agent B 产出,接口实测接线);热点簇真实查询由用户走查一并确认

### Step 4 — 视图④检索 + 视图⑤库健康
- [x] 检索:三模式切换、组/类型过滤、结果 «» 高亮(React 分段渲染防注入)、⊂模块徽章、右侧 marked 渲染全文
- [x] 健康:/stats 三状态卡 + lint 分层报告(架构层高亮区实数据 / 细节层嫌疑清单区=plan-4 占位空态不造假)、重建索引按钮(confirm+禁用态+结果摘要)
- **验证**:✅ 2026-07-19;vector/hybrid 报错含"可切关键词"提示;组列表按实证 12 组(不编造 index_8)

### Step 5 — 打包集成与整体走查
- [x] `pnpm build` 产物入库(修 webui 与根两级 .gitignore 的 dist 误忽略);server 挂 /ui 静态托管(StaticFiles html=True,无产物时缺席不报错);index.html 标题/favicon
- **验证**:✅ 2026-07-19——纯 `memoryhub serve` 下 /ui 200(61397 真实数据 + 61399 规模模拟双实例);全资源同源回环;五视图与 mockup 对照走查交用户浏览器确认(README 前端章节随 plan 收尾补)

## 7. 测试验证(整体验收)

1. 目标机模拟:无 Node 环境下 `memoryhub serve` → /ui 五视图全部可用(dist 托管验证)。
2. 用户验收脚本:打开总览 → 30 秒内说出"项目有 N 个模块、分几层、StateSync 连着谁"——达成"看清完整架构"的直观判据。
3. 影响面导出的回归清单 md 交给一次真实修改场景试用(用户主观评价可用性)。
4. 检索页与 MCP `memory_search` 同 query 结果一致(双端一致原则抽查)。
5. 页面所有资源来自 127.0.0.1(开发者工具 Network 面板核查,无外网请求)。

## 8. 风险 / 注意事项

| 风险 | 缓解 |
|---|---|
| 关系图节点/边增长后渲染卡顿 | 初版 15~25 模块无压力;feature 级边默认折叠、按需展开;ECharts 力导参数调优留后手 |
| dist 产物入库带来的体积与 diff 噪声 | echarts 按需引入后产物预估 ~600KB;构建产物变更只在前端迭代时发生,可接受 |
| 前端与后端接口漂移 | api.ts 单点封装+后端接口变更时同步改;验收第 4 条双端一致抽查 |
| 无 Node 的机器想改前端 | README 明示:运行不需要 Node,改前端才需要;远程机可只改后端 |

## 9. 不在本计划范围

- 网页端**编辑**模块/记忆(违背只读消费端原则;编辑走文件与子计划 4 AI 流程)
- 认证/多用户/远程访问(127.0.0.1 单机自用;局域网共享未来另议)
- 移动端适配、国际化(自用工具,简体中文桌面浏览器)

## 10. 待用户拍板

(无——技术栈已确认 HtyBox 同款轻量栈,见决策 1。)

本计划在子计划 2 的 arch API 可用后启动(视图④检索部分仅依赖子计划 1,可提前)。

### README 前端章节相应措辞

构建管理器与 HtyBox 一致用 pnpm;README「前端开发/构建」章节按 `pnpm install / pnpm dev / pnpm build` 撰写。

## 11. 执行记录

**执行日期**:2026-07-19
**执行模式**:AI 自动执行(脚手架/集成本会话 + 视图 2 agent 并行)+ 用户浏览器走查验收

### 11.1 决策汇总
| 项 | 结果 |
|---|---|
| 技术栈/视觉基准 | 均为执行前用户定稿(HtyBox 同款/六张 mockup),执行期无新决策 |
| 泳道图实现(执行期) | SVG 自绘(正交路由/焦点模式,echarts 不满足原则 6③)+ echarts 力导可切 |

### 11.2 实际改动
webui/ 全量(基建+五视图+双图组件,~2.4K 行)+ server /arch/graph /arch/lint /ui 静态托管 + 两级 .gitignore dist 修复;commits a566d35→ee9b1f3。

### 11.3 验证结果
- [x] 五视图真实数据接线(24 模块/108 边),build/oxlint 全绿
- [x] /ui 零 Node 运行(dist 入库);规模模拟 50 模块/200 边围栏与 graph 正确
- [x] 用户浏览器走查:发现力导 tooltip→resize→力导重跑闪烁环 → appendToBody+resize 变化判定根治(5130e0e)→ 用户确认"没问题了"

### 11.4 偏离计划之处
mockup 逐项微差已记 Step 2~4 验证行(演示假数据区留空态/深度胶囊代滑杆/组列表按实证 12 组等),无结构性偏离。

### 11.5 后续工作
(无——健康页审计队列区与 capture_mode 开关随 plan-4 补)

### 11.6 新风险/技术债
(无;echarts 全量 chunk 警告为既有体积提示,零 Node 运行不受影响)
