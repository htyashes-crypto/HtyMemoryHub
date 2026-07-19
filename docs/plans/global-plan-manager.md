# MemoryHub 项目知识系统(主题群统筹)

**日期范围**:2026-07-17 ~ 2026-07-19(✅ 主题群完工)
**主题**:把工作区记忆库升级为"项目知识系统"——语义检索、架构图谱与影响面分析、可视化前端、沉淀闭环四位一体,让用户与 AI 都能完整正确理解项目当前真实状态:改一个功能知道波及多少功能(→完整回归用例),做完需求/修完 bug 知识必沉淀,记忆始终最新、自洽、分类清晰、检索高效。
**触发来源**:2026-07-17 对话。第一轮:"向量数据库替代索引逐层查找";第二轮:扩展为可视化前端 + AI 架构接口 + 影响面/回归用例 + 沉淀闭环完整系统,拍板供应商自配/手动启动/接入 CLAUDE.md;第三轮:拍板图谱=重要记忆且优先级第二(铁律之后、细节之前)、前端参照 HtyBox 轻量栈(实测 React19+Vite7+Tailwind4,无状态库)、沉淀=双模式+auto 开关、skill 单轨化确认。

## 系统边界共识(全主题群共守)

- **工程组织(用户 2026-07-17 三次澄清后定案)**:
  - **代码自始至终在 `G:\hty_workflows\HtyMemoryHub\` 开发**(已建空目录)——它是 `G:\hty_workflows` hty 工作流生态下的一个应用(与 HtyBox 并列,未来多应用联动);git 按 HtyBox 既有模式独立仓(git init 于 HtyMemoryHub 目录),自带 README;**不存在"先 BGE 开发后迁代码"**。计划中代码路径简写 `HtyMemoryHub/` = `G:\hty_workflows\HtyMemoryHub\`。
  - **BGE 工作区承载**:实例物(`.htyworkflows/memoryhub/` config+db、`.mcp.json` 注册、CLAUDE.md/MEMORY.md 条款)、index_12 策展(内容=BGE memory)、skill 改造,以及**暂存**主题群计划文件与 mockup svg;执行会话从 BGE 发起(上下文/计划在此),代码按绝对路径写入 HtyMemoryHub。
  - **完工收尾仅迁文档**:主题群计划文件夹 + `.htyworkflows/svg/memoryhub/` 六张 mockup 迁至 hty_workflows 侧归档(见第 6 段收尾归档);此后 MemoryHub 维护与新功能开发在 `G:\hty_workflows` 工作区进行,BGE 只在接入变化时动实例物。
  - 其他工作区(GMApp 等)未来接入 = 从 HtyMemoryHub 仓库 clone 部署实例。
- **权威=md 文件**,SQLite 库与前端都是派生视图,可随时全量重建。
- **记忆优先级层级**(用户三轮拍板):**第一 最高铁律 → 第二 图谱结构(架构总览)→ 第三 各系统内部细节记忆**;MEMORY.md 段落顺序、AI 加载姿势(铁律→arch_overview→按需细节)、检索呈现均按此层级组织。
- **分层治理:人管架构,机器+AI 管细节**(用户四轮拍板:"记忆庞大后人工只看基础架构和分组,细节由 AI 看,确保 AI 正确性和架构遵循是关键")——**架构层变更**(模块/组的增删改名、关系类型、MEMORY.md 结构)必须贴用户批准;**细节层变更**(feature/边/普通记忆的增改)不再假设用户逐条过目,由 schema+lint **机器围栏硬拦** + AI 写入自查(dry_run→修正→真写)保障;沉淀报告**分层呈现**:触及架构层高亮置顶(需要人看),纯细节层标注"机器已校验"(可不看)。AI 挂接不上已有模块=架构缺口,必须上报用户走架构层流程,禁止自创模块塞进去。
- **记忆/图谱是已沉淀知识,代码才是 ground truth**:`arch_impact` 提供知识级波及证据,与变更契约既有的 Jet 代码级反扫是**互补双证据**,不互相替代。
- 影响面查全率靠"热点地图+bug-record 种子 → 沉淀闭环持续加边"逐步收敛,不承诺首日完美——每次真实回归都反哺为边(evidence),系统越用越准。

---

## 1. 子 plan 清单(按依赖顺序)

| # | 文件 | 状态 | 简述 |
|---|---|---|---|
| 1 | [2026-07-17-memory-vector-db-service.md](./2026-07-17-memory-vector-db-service.md) | ✅ **已完工**(2026-07-19;11 段归档;CLAUDE.md 条款挪主题群收尾) | 检索核心:Ollama bge-m3 本地嵌入 + FTS5 混合检索(两轮抽测过门槛),常驻 HTTP(MCP+REST+CLI),watchdog 增量 |
| 2 | [2026-07-17-arch-knowledge-graph.md](./2026-07-17-arch-knowledge-graph.md) | ✅ **已完工**(2026-07-19;11 段归档) | 架构知识图谱:24 模块/150 features/38 扩展点全实锚/108 边(17 BUG 证据);MEMORY.md 三层结构;arch_overview/module/impact API 六 MCP 工具在线;bug-record 反演 5/5;检索附 modules 归属 |
| 3 | [2026-07-17-web-dashboard.md](./2026-07-17-web-dashboard.md) | ✅ **已完工**(2026-07-19;用户走查确认,闪烁环根治;11 段归档) | 可视化前端:五视图上线 /ui(泳道 SVG 自绘焦点模式+力导可切,影响面导回归清单,检索 ⊂模块徽章,健康 lint 分层),dist 入库零 Node 运行 |
| 4 | [2026-07-17-memory-write-lifecycle.md](./2026-07-17-memory-write-lifecycle.md) | ✅ **已完工**(2026-07-19;三场景演练全绿;11 段归档) | 写入 API(原子:权威+双写+索引+lint 两级)与沉淀闭环:capture_mode 全链开关,三工作流文本单轨化+未部署机器 fallback 旧路径(`~/.memoryhub/install.json` 机器无关锚),skill 家族 dev/init/autostart/bootstrap |

**状态符号**:✅ 已完工 / 🔄 进行中 / ⏸ 待启动 / ❌ 弃用

## 2. 依赖关系

```
plan-1 检索核心 ──> plan-2 架构图谱 ──┬──> plan-3 可视化前端(视图④检索仅依赖 plan-1,可提前)
   (服务/库骨架)     (图谱schema/API)  └──> plan-4 沉淀闭环(Step1~3 仅依赖 plan-1,可提前动工)
```

- plan-2 依赖 plan-1 的 SQLite(schema_version 迁移)、scanner/store、服务骨架
- plan-3 依赖 plan-1 REST + plan-2 arch API;与 plan-4 **并行无依赖**
- plan-4 的 writer/lint/写入 API 仅依赖 plan-1,工作流条款(Step 4)依赖 plan-2 的图谱落地
- 推荐执行序:**1 → 2 → (3 ∥ 4)**;执行会话从 BGE 发起,代码写入 `G:\hty_workflows\HtyMemoryHub\`(工程组织见共识区)

## 3. 全局进度

- ✅ 阶段 1(plan-1):2026-07-19 完工归档——检索核心全链上线(Ollama bge-m3 本地嵌入 383 docs,两轮抽测过门槛,MCP/REST/CLI 三入口,watchdog 增量);CLAUDE.md 条款按用户指示挪主题群收尾
- ✅ 阶段 2(plan-2):2026-07-19 完工归档——24 模块图谱入库(双独立核对+围栏全绿),影响面 API 上线,bug-record 反演 3/5 补边后 5/5
- ✅ 阶段 3(plan-3):2026-07-19 完工归档——五视图 /ui 上线,用户走查确认,dist 入库零 Node
- ✅ 阶段 4(plan-4):2026-07-19 完工归档——写入 API+lint 两级+capture_mode 全链;三工作流文本经用户确认落盘(含 fallback 与机器无关锚两条补充);manual/auto/架构缺口三场景演练全绿

**主题群全部完工。** 后续维护入口:`G:\hty_workflows` 工作区 hty-memory-hub-dev skill。

## 4. 全局待拍板项(跨 plan 公共决策)

(无——全部决策已收敛并执行完毕。plan-2 决策 2 按默认 A 执行,用户未提异议。)

历史决策归档:图谱载体=memory 新组 index_12+优先级第二层;前端=HtyBox 同款(React19+Vite7+Tailwind4+icon-park+marked,无状态库,echarts/core 按需);沉淀触发=manual/auto 双模式开关(默认 manual);skill=API 单轨化;供应商=用户自配(实选 Ollama bge-m3 本地);启动=手动→后追加登录自启(Startup .vbs 通道);CLAUDE.md=接入(挪至收尾统一落盘,含 fallback 条款)。

## 5. 已踩坑/经验沉淀

- **Windows 系统代理拦回环 httpx**:注册表代理无本地例外 → 对 127.0.0.1 请求 403;凡 python 客户端连本机服务一律 `trust_env=False`(embedder 已内建)
- **MCP 工具表会话级缓存**:服务新增 MCP 工具后,已开会话看不到,须重启会话([[reference_mcp_session_tool_cache]] 旧知识在 MemoryHub 上再次验证)
- **双层 .gitignore 吞 dist**:uv 模板根 `dist/` + webui 模板 `dist` 叠加;根锚定 `/dist/` 才能让前端产物入库
- **schtasks 受策略拒绝**:自启走双通道(schtasks→Startup .vbs 零权限 fallback),如实报告所用通道
- **端口登记必须查配置层**:只探运行时端口会让未启动的实例被"占用"——`~/.memoryhub/ports.json` 机器级登记表+serve 归属校验双保险
- **部署判定禁绝对路径**:跨机器语义="记忆跟工程走,引擎跟机器走";锚=`~/.memoryhub/install.json`(register_port 顺带写),工作流文本只写机器无关谓词

## 6. 收尾归档

主题群所有子 plan 完工后:
- 每个子 plan 第 11 段「执行记录」由 `/plan-finish-code-review` 追加(plan-4 落地后,收尾流程本身即含沉淀清单)
- 本 manager 第 1 段所有行状态变 ✅,第 5 段沉淀关键经验
- **文档归档迁移**(工程组织定案):把本主题群文件夹 + `.htyworkflows/svg/memoryhub/` 六张 mockup + **`.htyworkflows/plans_waitChoose/` 中 MemoryHub 相关文件**(现有 `2026-07-17-memoryhub-embed-key-setup.md`,用户 2026-07-17 特别叮嘱勿忘)迁至 hty_workflows 侧(如 `G:\hty_workflows\HtyMemoryHub\docs\`),BGE 留指针;此后 MemoryHub 的计划/维护在 `G:\hty_workflows` 工作区起
- 主题群文件夹(迁移前)保留作复合任务历史档案
