import { useCallback, useEffect, useState } from "react";

import { api, type LintReport, type Stats } from "../api";

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border px-5 py-4" style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
      <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function HealthView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [lint, setLint] = useState<LintReport | null>(null);
  const [lintError, setLintError] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<string | null>(null);
  const [reindexError, setReindexError] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    api
      .stats()
      .then((s) => {
        setStats(s);
        setStatsError(null);
      })
      .catch((e) => {
        setStats(null);
        setStatsError((e as Error).message);
      })
      .finally(() => setStatsLoaded(true));
  }, []);

  useEffect(() => {
    loadStats();
    api
      .lint()
      .then((l) => {
        setLint(l);
        setLintError(null);
      })
      .catch((e) => {
        setLint(null);
        setLintError((e as Error).message);
      });
  }, [loadStats]);

  const reindex = () => {
    if (!window.confirm("确认重建索引?全量重建耗时取决于文档数与 embedding 服务。")) return;
    setReindexing(true);
    setReindexResult(null);
    setReindexError(null);
    api
      .reindex()
      .then((r) => {
        setReindexResult(JSON.stringify(r));
        loadStats();
      })
      .catch((e) => setReindexError(`重建索引失败:${(e as Error).message}`))
      .finally(() => setReindexing(false));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 状态卡行 */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="索引状态">
          {stats && (
            <>
              <div className="mt-2 flex items-center gap-2 text-[13px] font-semibold">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--success)" }} />
                健康 · {stats.docs} 文档 / {stats.chunks} 向量块
              </div>
              <div className="mt-2 text-[11px]" style={{ color: "var(--text-3)" }}>
                最后索引 {stats.lastIndexed ? new Date(stats.lastIndexed).toLocaleString() : "从未"}
              </div>
            </>
          )}
          {!stats && !statsLoaded && (
            <div className="mt-2 text-[13px]" style={{ color: "var(--text-3)" }}>
              加载中…
            </div>
          )}
          {!stats && statsLoaded && (
            <div className="mt-2 flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--danger)" }}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--danger)" }} />
              服务不可用:{statsError}
            </div>
          )}
        </StatCard>

        <StatCard label="Embedding 模型指纹">
          {stats?.embedding ? (
            <>
              <div className="mt-2 font-mono text-xs font-semibold break-all">
                {stats.embedding.model} @ {stats.embedding.baseUrl} · dim {stats.embedding.dim}
              </div>
              <div className="mt-2 text-[11px]" style={{ color: "var(--text-3)" }}>
                指纹不匹配将拒绝增量并要求全量重建
              </div>
            </>
          ) : (
            <div className="mt-2 text-[13px]" style={{ color: "var(--text-3)" }}>
              {stats ? "未配置(仅关键词检索可用)" : "-"}
            </div>
          )}
        </StatCard>

        <StatCard label="服务信息">
          {stats ? (
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0 font-mono text-[11px] leading-relaxed" style={{ color: "var(--text-deep)" }}>
                <div>port {stats.port}</div>
                <div className="truncate" title={stats.workspace}>
                  workspace {stats.workspace}
                </div>
                <div className="truncate" title={stats.memoryRoot}>
                  memoryRoot {stats.memoryRoot}
                </div>
              </div>
              <button
                onClick={reindex}
                disabled={reindexing}
                className="shrink-0 cursor-pointer rounded-lg border px-4 py-2 text-xs font-semibold disabled:cursor-default disabled:opacity-60"
                style={{ borderColor: "var(--accent-border)", color: "var(--accent-text)" }}
              >
                {reindexing ? "重建中…" : "重建索引"}
              </button>
            </div>
          ) : (
            <div className="mt-2 text-[13px]" style={{ color: "var(--text-3)" }}>
              -
            </div>
          )}
        </StatCard>
      </div>

      {/* 重建索引结果 / 错误 */}
      {reindexError && (
        <div
          className="rounded-lg border px-4 py-3 text-xs"
          style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border-soft)", color: "var(--danger)" }}
        >
          {reindexError}
        </div>
      )}
      {reindexResult && (
        <div
          className="rounded-lg border px-4 py-3 text-[11px]"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          <span style={{ color: "var(--success)" }}>重建完成 ✓ </span>
          <span className="font-mono break-all" style={{ color: "var(--text-2)" }} title={reindexResult}>
            {reindexResult.length > 400 ? reindexResult.slice(0, 400) + "…" : reindexResult}
          </span>
        </div>
      )}

      {/* 架构层:围栏报告(高亮置顶) */}
      <div
        className="rounded-[14px] border p-5"
        style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border)" }}
      >
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-[14px] font-bold tracking-wide" style={{ color: "var(--accent-text)" }}>
            ⚑ 架构层 · 待裁决
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-2)" }}>
            模块 / 组 / 关系类型级变更须人工批准,机器围栏逐条列出违规
          </span>
        </div>
        {lint && lint.errors.length === 0 && (
          <div className="mt-3 text-[13px] font-semibold" style={{ color: "var(--success)" }}>
            围栏全绿 ✓ 模块 {lint.modules} · features {lint.features} · 扩展点 {lint.extensionPoints} · 边 {lint.edges}
          </div>
        )}
        {lint && lint.errors.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {lint.errors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed"
                style={{ background: "var(--elevated)", borderColor: "var(--accent-border-soft)" }}
              >
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--danger)" }} />
                <span style={{ color: "var(--text-deep)" }}>{err}</span>
              </div>
            ))}
          </div>
        )}
        {!lint && lintError && (
          <div className="mt-3 text-xs" style={{ color: "var(--danger)" }}>
            围栏报告加载失败:{lintError}
          </div>
        )}
        {!lint && !lintError && (
          <div className="mt-3 text-xs" style={{ color: "var(--text-3)" }}>
            加载中…
          </div>
        )}
      </div>

      {/* 细节层:嫌疑清单(占位空态) */}
      <div className="rounded-[14px] border p-5" style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
        <div className="text-[14px] font-bold tracking-wide">细节层 · 嫌疑清单</div>
        <div className="mt-3 text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
          审计队列随沉淀闭环(plan-4)上线:分类漂移 / 重复嫌疑 / 断链候选将在此列出,由 AI 审计会话消化。
        </div>
      </div>
    </div>
  );
}
