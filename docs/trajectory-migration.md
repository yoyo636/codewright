# 迁移至「一切皆轨迹」架构

> 状态：**Phase 0（实体层 + 存储地基）已落地**，本文档为全量迁移的路线图与代码映射。
> 顶层原则：将「运行实例」从瞬态进程转变为**持久化的轨迹图（Trajectory Graph）**。所有功能组件围绕轨迹的创建、追加、分叉、回放与蒸馏重新设计。

## 1. 目标数据模型（已落地）

位置：`packages/core/src/trajectory/`

| 实体 | 字段（要点） | 落点 |
|---|---|---|
| `Trajectory` | id、root_node_id、resource_hash、version、time_created | `trajectory/schema.ts` |
| `Node` | step_index、input/output_payload、tool_call_id、tool_name、reasoning_summary、parent_ids（多父）、fork_ids、state_snapshot、resource_usage（Token/时间/存储）、metadata.annotations | `trajectory/schema.ts` |
| `Edge` | from/to_node_id、kind（causal/data/control/merge）、data_key | `trajectory/schema.ts` |
| 存储 | 三表 + 唯一约束 `(trajectory, branch, step)` + 倒排索引（tool_name / input_fingerprint / time_ms） | `trajectory/sql.ts` + migration `20260820131045_deep_thing` |

存储服务 `TrajectoryStore`（`trajectory/store.ts`）提供：`create` / `append`（Append-Only，同步写 control/causal 边）/ `fork` / `merge`（基线哈希冲突检测）/ `children` / `ancestors` / `byToolName` / `byInputFingerprint` / `byDurationRange` / `replay`（从任意节点出发、按因果 DAG 拓扑序的流式回放）。

测试：`test/trajectory-store.test.ts`（9 项，全部通过）。

## 2. 迁移阶段划分

### Phase 0 —— 实体层与存储地基 ✅ 已完成
- [x] Trajectory/Node/Edge Effect Schema
- [x] Append-Only Drizzle 存储 + 二级索引 + migration
- [x] fork / merge / replay / 索引查询 基础实现 + 单测

### Phase 1 —— 状态外部化（StateStore）
把执行期间所有可变状态迁移出内存，写入节点 `state_snapshot`。

| 现状（状态持有者） | 代码位置 | 迁移动作 |
|---|---|---|
| Session 运行时状态（prompt inbox、projector 游标、context epoch） | `core/src/session/`（`input.ts`、`projector.ts`、`context-epoch.ts`、`sql.ts`） | 定义 `StateStore` 接口（`core/src/trajectory/state-store.ts`），`snapshot()` 序列化到 Node.state_snapshot；恢复时由 Node Stepper 沿父链反序列化重建 |
| System Context 快照 | `core/src/system-context/`（registry、snapshot） | 作为 Context Source 写入 state_snapshot 的 `system_context` 键 |
| 工具注册表/权限（运行时内存态） | `core/src/tool/`、`core/src/permission/` | 声明性配置已持久化；仅迁移"运行时叠加状态" |
| 全局/实例缓存（`Global`、`InstanceState`） | `core/src/global.ts`、`opencode/src/effect/instance-state.ts` | 识别启动期配置类缓存（保留）与执行期状态（迁移） |

**验收**：`kill -9` 后从最后节点 fork 恢复，上下文与崩溃前一致。

### Phase 2 —— 执行引擎：Node Stepper

现状：V2 Session 主循环在 `core/src/session/runner/`（`llm.ts`、`model.ts`、`max-steps.ts`）与 `core/src/session/execution/local.ts`（Session Drain 内连续执行多个 provider turn）。

迁移：
1. 新增 `core/src/trajectory/stepper.ts`：`Node Stepper` 接口 —— 每次**只执行一个节点**：读入 `input_payload + state_snapshot` → 执行 → 立即 `TrajectoryStore.append` 落盘 → 返回新节点。无内存中的 while/for 主循环。
2. `runner/llm.ts` 的 `llm.stream(request)` 调用改为"一步一节点"：请求入 `input_payload`，响应（消息/工具结算）入 `output_payload`。
3. `execution/local.ts` 的 Drain 语义改为**轨迹推进器**：`advance(trajectoryID, branchID)` 从分支头继续一步；继续条件由「prompt 收件箱」变为「轨迹上有可推进的节点」。
4. 恢复执行 = `TrajectoryStore.replay` + Stepper 重放，而非内存续跑。

**兼容策略**：Session 实体暂保留为"轨迹的投影视图"（`trajectory_id` 挂在 session 上），对外 API 不变，内部数据流切换到轨迹。

### Phase 3 —— 工具调用封装为可重入事务

现状：`core/src/tool/`（read/write/edit/bash/glob/grep/webfetch/websearch/question/skill/todowrite）+ `llm/src/tool-runtime.ts`（工具结算）。

迁移：
- 工具执行包装器 `core/src/trajectory/tool-transaction.ts`：调用前记录输入指纹（`canonicalJson` + sha256，已实现）；调用后把 stdout/stderr/exit_code/副作用文件变更封装进 `output_payload`；资源统计写 `resource_usage`。
- 工具函数签名收敛为 `(input, nodeContext) => Effect<NodeResult>`：`NodeResult` 为结构化返回（payload + 副作用声明 + 资源快照）。
- `Tool Registry` 大小上限 → 超限输出进 Managed Tool Output File 的逻辑保留，但文件引用作为 Node 的 `output_payload` 一部分。

### Phase 4 —— Fork 协议与时间旅行调试

现状：无分叉概念；异常走重试/回滚。

迁移：
- `TrajectoryStore.fork` 已实现：`fork --at <node_id>` → 新 branch_id + 分叉头节点（继承祖先链、state_snapshot）；原轨迹零改动。
- 新增 API/CLI：`core/src/trajectory/fork.ts` 暴露 `ForkRequest` 模型；`protocol/src/groups/trajectory.ts` + `server/src/handlers/trajectory.ts` 暴露 `fork` / `merge` / `replay` 端点；`opencode` CLI 加 `trajectory fork --at <node_id>` 命令。
- 因果冲突检测已实现（`merge` 基线哈希比较 + `MergeConflict`）：冲突时要求 resolution 脚本或覆盖策略。
- 异常路径：执行失败 → 当前节点标记为 orphan（`metadata.annotations.orphan = true`）→ 提示用户选择分叉点，禁止自动回溯。

### Phase 5 —— 回放与蒸馏引擎

- `replay` 数据层已实现（拓扑序流）；**确定性回放校验**：重放节点时用 `input_payload + state_snapshot` 重执行，与原始 `output_payload` 自动 Diff，标记"非确定性偏差"（`core/src/trajectory/distill.ts`）。
- **轨迹蒸馏**：子图模式提取为 Macro Node：`distill(pattern: Node[], name) => newTool`；Macro Node 注册回工具中心（`core/src/tool/registry.ts` 支持动态注册），实现"运行即编码"自举。

### Phase 6 —— 多智能体协作（轨迹共享空间）

现状：`core/src/event.ts` + `event/`（EventV2 事件总线）。

迁移：Agent 间不再直接发消息，而是追加节点到共享轨迹池；下游通过声明依赖父节点 ID 挂载（`data_edges` 已支持）。EventV2 保留为"轨迹外的事件通知通道"（审计/UI 刷新），不再承载执行编排。

### Phase 7 —— 接口与日志规范

- **输出拦截**：`server/src/handlers/` 的会话/消息响应附带 `trajectory_id` + 当前 `node_id` + 最近 3 步祖先简述（`TrajectoryStore.ancestors(node, { max_depth: 4 })` 已支持）。
- **调试日志迁移**：新增日志层重定向 —— logger 输出写入当前节点的 `metadata.annotations`（同构、可查询），文本日志仅作兜底。

## 3. 用户迁移清单 → 落点对照

| # | 清单项 | 落点 |
|---|---|---|
| 1 | 扫描状态持有者 → StateStore | Phase 1（表见上） |
| 2 | 入口拆分为「初始化轨迹」+「循环步进」 | `packages/opencode/src/index.ts` / `cli/` 启动流程；`opencode/src/session` |
| 3 | 工具装饰器 → Node Context / Node Result | `core/src/tool/*` + `llm/src/tool-runtime.ts`（Phase 3） |
| 4 | 历史记录批量转 `.traj` 归档 | `core/script/` 新增 `export-trajectories.ts`：读取 `session`/`session_message`/`session_input` 表 → `TrajectoryStore.append` 逐条重建 |
| 5 | 注释线性循环单测，重写分叉/回放集成测试 | `core/src/session/runner/*.test.ts` → `test/trajectory-*.test.ts`（已开始） |

## 4. 执行约束（Side-effect Declaration）

任何无法直接映射为轨迹操作的现有功能（直接改库命令、外部副作用）必须先封装为副作用声明存根：

```ts
// core/src/trajectory/side-effect.ts
export type SideEffectDeclaration = {
  readonly kind: "db-mutation" | "external-call" | "fs-write" | "env-mutation"
  readonly target: string
  readonly fingerprint: string // canonical input hash
  readonly declared: boolean
}
```

未声明副作用一律不得绕过轨迹系统执行（Phase 3 的 `tool-transaction.ts` 强制校验）。

## 5. 风险与注意

- **兼容**：Session/EventV2 保留为投影/通知层，避免一次性推翻导致桌面/Web 前端不可用；逐步切换数据流。
- **契约**：改 `protocol`/`server` 后需在 `packages/client` 跑 `bun run generate`（AGENTS.md）。
- **性能**：每步一次事务 + 索引写入，需批量 append 优化（后续支持 `appendMany` 与 WAL 批提交）。
- **测试**：根目录禁跑测试；从包目录 `bun test` / `bun typecheck`。
