import { useCallback, useEffect, useMemo, useState } from "react";

import { api, type Impact, type ImpactItem, type ModuleBrief } from "../api";

/* ---------- 边类型:颜色 / 线型 / 中文名(颜色与 index.css 关系边四色 token 对齐) ---------- */

const EDGE_COLOR: Record<string, string> = {
  affects: "var(--edge-aff)",
  depends_on: "var(--edge-dep)",
  shares_state: "var(--edge-share)",
  extends: "var(--edge-rel)",
};

const EDGE_DASH: Record<string, string> = {
  affects: "9 5",
  shares_state: "1.5 4.5",
  extends: "4 3",
};

const EDGE_LABEL: Record<string, string> = {
  affects: "影响",
  depends_on: "依赖",
  shares_state: "共享状态",
  extends: "扩展",
};

const edgeColor = (t: string) => EDGE_COLOR[t] ?? "var(--edge-rel)";
const edgeLabel = (t: string) => EDGE_LABEL[t] ?? t;

/* ---------- 波及子图(放射状:中心=改动目标,跳数=半径,线型=边类型) ---------- */

interface NodePos {
  it: ImpactItem;
  hop: number;
  x: number;
  y: number;
  angle: number;
  px: number; // 边起点(中心或经由的上一跳节点)
  py: number;
  fromCenter: boolean;
}

function splitLabel(s: string): string[] {
  if (s.length <= 6) return [s];
  const rest = s.slice(6);
  return [s.slice(0, 6), rest.length > 6 ? rest.slice(0, 5) + "…" : rest];
}

function ImpactGraph({ impact, titleOf }: { impact: Impact; titleOf: (n: string) => string }) {
  const hops = impact.hops.filter((h) => h.items.length > 0);
  const maxHop = hops.reduce((m, h) => Math.max(m, h.hop), 1);
  const radiusOf = (hop: number) => 150 + (hop - 1) * 84;
  const size = 2 * (radiusOf(maxHop) + 42);
  const c = size / 2;
  const nodeR = (hop: number) => (hop === 1 ? 30 : 25);

  const placed: NodePos[] = [];
  for (const h of hops) {
    if (h.hop === 1) {
      h.items.forEach((it, i) => {
        const angle = -Math.PI / 2 + (i / h.items.length) * Math.PI * 2;
        placed.push({
          it,
          hop: 1,
          x: c + radiusOf(1) * Math.cos(angle),
          y: c + radiusOf(1) * Math.sin(angle),
          angle,
          px: c,
          py: c,
          fromCenter: true,
        });
      });
      continue;
    }
    // 第 2+ 跳:按 via 文本里出现的上一跳模块归组,贴近其角度放置
    const prev = placed.filter((p) => p.hop === h.hop - 1);
    const grouped = new Map<number, ImpactItem[]>();
    h.items.forEach((it) => {
      const pi = prev.findIndex((p) => it.via.includes(p.it.module));
      grouped.set(pi, [...(grouped.get(pi) ?? []), it]);
    });
    grouped.forEach((list, pi) => {
      const parent = pi >= 0 ? prev[pi] : null;
      const base = parent ? parent.angle : -Math.PI / 2 + 0.35;
      list.forEach((it, k) => {
        const angle = base + (k - (list.length - 1) / 2) * 0.5;
        placed.push({
          it,
          hop: h.hop,
          x: c + radiusOf(h.hop) * Math.cos(angle),
          y: c + radiusOf(h.hop) * Math.sin(angle),
          angle,
          px: parent ? parent.x : c,
          py: parent ? parent.y : c,
          fromCenter: !parent,
        });
      });
    });
  }

  const centerLines = splitLabel(titleOf(impact.target));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto block w-full" style={{ maxWidth: 560 }}>
      {placed.map((p, i) => {
        const dx = p.x - p.px;
        const dy = p.y - p.py;
        const len = Math.hypot(dx, dy) || 1;
        const srcR = p.fromCenter ? 46 : nodeR(p.hop - 1) + 3;
        const dstR = nodeR(p.hop) + 3;
        return (
          <line
            key={`e${i}`}
            x1={p.px + (dx / len) * srcR}
            y1={p.py + (dy / len) * srcR}
            x2={p.x - (dx / len) * dstR}
            y2={p.y - (dy / len) * dstR}
            stroke={edgeColor(p.it.type)}
            strokeWidth={p.hop === 1 ? 2 : 1.5}
            strokeDasharray={EDGE_DASH[p.it.type]}
            strokeLinecap="round"
            opacity={p.hop === 1 ? 0.9 : 0.65}
          />
        );
      })}
      <circle cx={c} cy={c} r={42} fill="var(--accent)" stroke="var(--accent-text)" strokeWidth={2} />
      <text x={c} y={c - (centerLines.length > 1 ? 8 : 2)} textAnchor="middle" fontSize={11} fontWeight={700} className="fill-white">
        {centerLines.map((ln, i) => (
          <tspan key={i} x={c} dy={i === 0 ? 0 : 12}>
            {ln}
          </tspan>
        ))}
      </text>
      <text x={c} y={c + (centerLines.length > 1 ? 22 : 14)} textAnchor="middle" fontSize={9.5} className="fill-white" opacity={0.85}>
        (改动目标)
      </text>
      {placed.map((p, i) => {
        const lines = splitLabel(titleOf(p.it.module));
        return (
          <g key={`n${i}`} opacity={p.hop === 1 ? 1 : Math.max(0.62, 1 - (p.hop - 1) * 0.18)}>
            <title>
              {p.it.module} · {edgeLabel(p.it.type)}
            </title>
            <circle
              cx={p.x}
              cy={p.y}
              r={nodeR(p.hop)}
              fill={p.hop === 1 ? "var(--accent-soft)" : "var(--elevated)"}
              stroke={p.hop === 1 ? edgeColor(p.it.type) : "var(--accent-border)"}
              strokeWidth={p.hop === 1 ? 2 : 1.5}
              strokeDasharray={p.hop === 1 ? undefined : "3 2"}
            />
            <text x={p.x} y={p.y + (lines.length > 1 ? -1 : 3)} textAnchor="middle" fontSize={10} fill="var(--text-deep)">
              {lines.map((ln, j) => (
                <tspan key={j} x={p.x} dy={j === 0 ? 0 : 11}>
                  {ln}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- 影响面分析视图 ---------- */

export default function ImpactView({
  initialTarget,
  onOpenModule,
}: {
  initialTarget: string | null;
  onOpenModule: (n: string) => void;
}) {
  const [modules, setModules] = useState<ModuleBrief[]>([]);
  const [target, setTarget] = useState(initialTarget ?? "");
  const [depth, setDepth] = useState(2);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"md" | "ai" | null>(null);

  useEffect(() => {
    api
      .overview()
      .then((o) => {
        const all = Object.values(o.layers).flat();
        setModules(all);
        setTarget((t) => t || (all[0]?.name ?? ""));
      })
      .catch((e) => setError(`模块列表加载失败:${(e as Error).message}`));
  }, []);

  const analyze = useCallback((t: string, d: number) => {
    if (!t) return;
    setLoading(true);
    setError(null);
    api
      .impact(t, d)
      .then(setImpact)
      .catch((e) => {
        setImpact(null);
        setError(`影响面分析失败:${(e as Error).message}`);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialTarget) {
      setTarget(initialTarget);
      analyze(initialTarget, 2);
    }
  }, [initialTarget, analyze]);

  const titleOf = useMemo(() => {
    const m = new Map(modules.map((b) => [b.name, b.title]));
    return (name: string) => m.get(name) ?? name.replace(/^module_/, "");
  }, [modules]);

  const isEmpty = impact !== null && impact.hops.every((h) => h.items.length === 0);

  const buildMarkdown = useCallback(() => {
    if (!impact) return "";
    const lines: string[] = [`## 改 ${impact.target} 的回归检查清单`, ""];
    impact.hops
      .filter((h) => h.items.length > 0)
      .forEach((h) => {
        lines.push(`### 第 ${h.hop} 跳${h.hop === 1 ? "(直接波及)" : "(经传导)"}`);
        h.items.forEach((it) => {
          const ev = it.evidence.length > 0 ? ` ${it.evidence.join(" ")}` : "";
          lines.push(`- [ ] ${it.module}(${it.type}):${it.reason}${ev}`);
        });
        lines.push("");
      });
    return lines.join("\n");
  }, [impact]);

  const copy = (kind: "md" | "ai") => {
    const md = buildMarkdown();
    const text =
      kind === "ai" ? `请基于以下知识级波及面展开完整回归测试用例,并配合代码级反扫互补:\n\n${md}` : md;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(kind);
        setTimeout(() => setCopied(null), 1600);
      },
      (e) => setError(`复制到剪贴板失败:${(e as Error).message}`),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 查询条 */}
      <div
        className="flex flex-wrap items-end gap-5 rounded-xl border px-5 py-4"
        style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
      >
        <div className="min-w-[260px]">
          <div className="mb-1.5 text-[11px]" style={{ color: "var(--text-3)" }}>
            要改的目标
          </div>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full cursor-pointer rounded-md border px-2.5 py-1.5 text-xs outline-none"
            style={{ background: "var(--elevated)", borderColor: "var(--accent-border)", color: "var(--text)" }}
          >
            {modules.length === 0 && <option value="">模块列表加载中…</option>}
            {modules.map((m) => (
              <option key={m.name} value={m.name}>
                {m.title}({m.name})
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="mb-1.5 text-[11px]" style={{ color: "var(--text-3)" }}>
            深度
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={
                  "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs" + (depth === d ? " text-white" : "")
                }
                style={
                  depth === d
                    ? { background: "var(--accent)", borderColor: "var(--accent)", fontWeight: 600 }
                    : { borderColor: "var(--border)", color: "var(--text-3)" }
                }
              >
                {d} 跳
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => analyze(target, depth)}
          disabled={!target || loading}
          className="ml-auto cursor-pointer rounded-lg px-6 py-2 text-[13px] font-semibold text-white disabled:cursor-default disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          {loading ? "分析中…" : "分析波及面"}
        </button>
      </div>

      {error && (
        <div
          className="rounded-lg border px-4 py-3 text-xs"
          style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border-soft)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      {!impact && !loading && !error && (
        <div
          className="rounded-[14px] border px-5 py-10 text-center text-[13px]"
          style={{ background: "var(--elevated)", borderColor: "var(--border)", color: "var(--text-3)" }}
        >
          选择要改的目标模块,点「分析波及面」查看知识级波及清单与子图。
        </div>
      )}

      {impact && isEmpty && (
        <div
          className="rounded-[14px] border px-5 py-10 text-center text-[13px]"
          style={{ background: "var(--elevated)", borderColor: "var(--border)", color: "var(--text-3)" }}
        >
          该模块暂无已沉淀波及边。
        </div>
      )}

      {impact && !isEmpty && (
        <div className="flex flex-col gap-4 xl:flex-row">
          {/* 左:波及子图 */}
          <div
            className="flex flex-col rounded-[14px] border p-5 xl:w-[46%]"
            style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-[14px] font-bold tracking-wide">波及子图</span>
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                颜色渐淡 = 跳数 · 虚线 影响 / 点线 共享状态 / 实线 依赖
              </span>
            </div>
            <div className="flex flex-1 items-center py-3">
              <ImpactGraph impact={impact} titleOf={titleOf} />
            </div>
            {impact.note && (
              <div
                className="rounded-lg px-3.5 py-2.5 text-[11px] leading-relaxed"
                style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
              >
                ⚠ {impact.note}
              </div>
            )}
          </div>

          {/* 右:分层清单 */}
          <div
            className="flex min-w-0 flex-1 flex-col rounded-[14px] border p-5"
            style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
          >
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-[14px] font-bold tracking-wide">波及清单</span>
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                {impact.affected} 项 · 按跳数分层 · 每项附理由与历史证据
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-5">
              {impact.hops
                .filter((h) => h.items.length > 0)
                .map((h) => (
                  <div key={h.hop}>
                    <div className="mb-2 text-xs font-bold tracking-wide" style={{ color: "var(--accent-text)" }}>
                      第 {h.hop} 跳{h.hop === 1 ? "(直接波及)" : "(经传导)"}
                    </div>
                    <div className="flex flex-col gap-2">
                      {h.items.map((it) => (
                        <div
                          key={`${it.module}-${it.type}`}
                          className="rounded-lg px-3.5 py-3"
                          style={{ background: "var(--surface-soft)" }}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: edgeColor(it.type) }}
                            />
                            <button
                              onClick={() => onOpenModule(it.module)}
                              className="cursor-pointer text-[12.5px] font-semibold hover:underline"
                              style={{ color: "var(--text)" }}
                              title={it.module}
                            >
                              {titleOf(it.module)}
                            </button>
                            <span className="text-[10.5px]" style={{ color: edgeColor(it.type) }}>
                              {edgeLabel(it.type)}
                            </span>
                            {it.evidence.length > 0 && (
                              <span className="ml-auto flex flex-wrap gap-1.5">
                                {it.evidence.map((ev) => (
                                  <span
                                    key={ev}
                                    className="rounded-full border px-2 py-0.5 text-[10px]"
                                    style={{
                                      background: "var(--elevated)",
                                      borderColor: "var(--accent-border-soft)",
                                      color: "var(--accent-text)",
                                    }}
                                  >
                                    {ev}
                                  </span>
                                ))}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 pl-4 text-[11px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                            {it.type}:{it.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border-soft)" }}>
              <div className="text-[11.5px]" style={{ color: "var(--text-2)" }}>
                导出内容 = 波及功能 × 回归检查点 × 历史证据,可直接交 AI 展开为完整回归用例。
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  onClick={() => copy("md")}
                  className="cursor-pointer rounded-lg px-5 py-2.5 text-[13px] font-semibold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  {copied === "md" ? "已复制 ✓" : "导出回归清单 markdown"}
                </button>
                <button
                  onClick={() => copy("ai")}
                  className="cursor-pointer rounded-lg border px-5 py-2.5 text-xs"
                  style={{ borderColor: "var(--accent-border)", color: "var(--accent-text)" }}
                >
                  {copied === "ai" ? "已复制 ✓" : "复制给 AI 会话"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
