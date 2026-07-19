/** 架构总览:统计卡行 + 全局架构图(分层泳道 / 力导双模式,骨架边 + 焦点模式 + 图例过滤)+ 右侧按分层模块列。 */
import { useCallback, useEffect, useMemo, useState } from "react";

import { api, type Graph, type GraphEdge, type Overview } from "../api";
import { DEFAULT_ENABLED_TYPES, EDGE_TYPES, orderLayers, type EdgeTypeStyle } from "../components/archShared";
import { ErrorState, LoadingState } from "../components/Feedback";
import ForceGraph from "../components/ForceGraph";
import SwimlaneGraph, { type LaneData } from "../components/SwimlaneGraph";

function StatCard({ num, label }: { num: number; label: string }) {
  return (
    <div className="rounded-xl border px-5 py-4" style={{ background: "var(--elevated)", borderColor: "var(--border)" }}>
      <div className="text-[26px] leading-8 font-bold" style={{ color: "var(--text)" }}>
        {num}
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--text-2)" }}>
        {label}
      </div>
    </div>
  );
}

/** 图例线样小样张:线型 + 箭头实形与图内边一致 */
function LegendGlyph({ t }: { t: EdgeTypeStyle }) {
  return (
    <svg width={30} height={10} viewBox="0 0 30 10" className="shrink-0">
      <line
        x1={0} y1={5} x2={t.marker === "none" ? 30 : 21} y2={5}
        style={{ stroke: t.colorVar }} strokeWidth={1.8}
        strokeDasharray={t.dash || undefined}
        strokeLinecap={t.type === "shares_state" ? "round" : undefined}
      />
      {t.marker === "solid" && <path d="M22,1 L30,5 L22,9 Z" style={{ fill: t.colorVar }} />}
      {t.marker === "hollow" && (
        <path d="M22.7,1.7 L29,5 L22.7,8.3 Z" style={{ fill: "var(--elevated)", stroke: t.colorVar }} strokeWidth={1.3} />
      )}
      {t.marker === "diamond" && <path d="M21,5 L25.5,1.5 L30,5 L25.5,8.5 Z" style={{ fill: t.colorVar }} />}
    </svg>
  );
}

export default function OverviewView({ onOpenModule }: { onOpenModule: (n: string) => void }) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"lane" | "force">("lane");
  const [focus, setFocus] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Set<string>>(new Set(DEFAULT_ENABLED_TYPES));

  const load = useCallback(() => {
    setErr(null);
    setOv(null);
    setGraph(null);
    Promise.all([api.overview(), api.graph()])
      .then(([o, g]) => {
        setOv(o);
        setGraph(g);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(load, [load]);

  const lanes: LaneData[] = useMemo(() => {
    if (!ov) return [];
    return orderLayers(Object.keys(ov.layers)).map((layer) => ({
      layer,
      nodes: (ov.layers[layer] ?? []).map((m) => ({
        name: m.name,
        title: m.title,
        sub: `${m.features} features`,
        extensionPoints: m.extensionPoints,
      })),
    }));
  }, [ov]);

  const titleOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const lane of lanes) for (const n of lane.nodes) map.set(n.name, n.title);
    return map;
  }, [lanes]);

  // 焦点节点的邻接集(按全部边算,不受图例过滤影响);其余节点淡化
  const dimmed = useMemo(() => {
    if (!focus || !graph) return null;
    const keep = new Set<string>([focus]);
    for (const e of graph.edges) {
      if (e.src === focus) keep.add(e.target);
      if (e.target === focus) keep.add(e.src);
    }
    const s = new Set<string>();
    for (const n of graph.nodes) if (!keep.has(n.name)) s.add(n.name);
    return s;
  }, [focus, graph]);

  // 泳道可见边:焦点态 = 该节点全部相关边;否则全图;再按图例类型过滤
  const laneEdges: GraphEdge[] = useMemo(() => {
    if (!graph) return [];
    const base = focus ? graph.edges.filter((e) => e.src === focus || e.target === focus) : graph.edges;
    return base.filter((e) => enabled.has(e.type));
  }, [graph, focus, enabled]);

  const forceEdges: GraphEdge[] = useMemo(
    () => (graph ? graph.edges.filter((e) => enabled.has(e.type)) : []),
    [graph, enabled],
  );

  // 进焦点自动放开全部边类型;退出恢复 depends_on 骨架
  const handleFocus = useCallback((n: string | null) => {
    setFocus(n);
    setEnabled(n ? new Set(EDGE_TYPES.map((t) => t.type)) : new Set(DEFAULT_ENABLED_TYPES));
  }, []);

  const toggleType = (t: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  if (err) return <ErrorState message={`架构总览加载失败:${err}`} onRetry={load} />;
  if (!ov || !graph) return <LoadingState text="正在加载架构总览…" />;

  const extTotal = graph.nodes.reduce((s, n) => s + n.extensionPoints, 0);
  const layerLabel = (layer: string) => `${layer.split("/").join(" / ")}层`;

  return (
    <div className="flex flex-col gap-4">
      {/* 统计卡行 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard num={ov.modules} label="模块" />
        <StatCard num={ov.edges} label="关系边" />
        <StatCard num={extTotal} label="扩展点" />
        <StatCard num={lanes.length} label="架构分层" />
      </div>

      <div className="flex items-start gap-4">
        {/* 全局架构图卡 */}
        <section
          className="min-w-0 flex-1 rounded-[14px] border p-5"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>
              全局架构图
            </h2>
            {/* 模式切换胶囊 */}
            <div
              className="flex overflow-hidden rounded-full border text-[11px]"
              style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
            >
              {([["lane", "分层泳道"], ["force", "力导"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setMode(k)}
                  className={`cursor-pointer px-3 py-1 ${mode === k ? "font-semibold text-white" : ""}`}
                  style={mode === k ? { background: "var(--accent)" } : { color: "var(--text-3)" }}
                >
                  {mode === k ? `${label} ✓` : label}
                </button>
              ))}
            </div>
            {/* 图例 + 类型过滤胶囊 */}
            {EDGE_TYPES.map((t) => {
              const on = enabled.has(t.type);
              return (
                <button
                  key={t.type}
                  onClick={() => toggleType(t.type)}
                  title={`点击${on ? "隐藏" : "显示"}「${t.label}」边`}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
                  style={{
                    borderColor: on ? "var(--accent-border)" : "var(--border)",
                    background: on ? "var(--surface-soft)" : "transparent",
                    color: "var(--text-2)",
                    opacity: on ? 1 : 0.45,
                  }}
                >
                  <LegendGlyph t={t} />
                  {t.label}
                </button>
              );
            })}
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-2)" }}>
              <span
                className="flex h-[17px] w-[22px] items-center justify-center rounded border text-[10px]"
                style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border)", color: "var(--accent-text)" }}
              >
                ⊞
              </span>
              扩展族
            </span>
            {/* 焦点胶囊 */}
            {focus && (
              <span
                className="ml-auto flex items-center gap-2 rounded-full px-3 py-1 text-[11px] text-white"
                style={{ background: "var(--accent)" }}
              >
                ◉ 焦点:{titleOf.get(focus) ?? focus}
                <button onClick={() => handleFocus(null)} className="cursor-pointer font-bold text-white">
                  ✕
                </button>
              </span>
            )}
          </div>

          {mode === "lane" ? (
            <SwimlaneGraph
              lanes={lanes}
              edges={laneEdges}
              focus={focus}
              dimmed={dimmed}
              onFocus={handleFocus}
              onOpenModule={onOpenModule}
            />
          ) : (
            <ForceGraph nodes={graph.nodes} edges={forceEdges} onOpenModule={onOpenModule} />
          )}

          {/* 阅读策略说明 */}
          <div
            className="mt-3 rounded-[10px] p-3 text-[11px] leading-5"
            style={{ background: "var(--surface-soft)", color: "var(--text-2)" }}
          >
            <div>
              <span className="font-bold" style={{ color: "var(--text-deep)" }}>
                形态读法:
              </span>
              纵向 = 跨层依赖链 · 同道并列且无边 = 平行 · <span style={{ color: "var(--accent-text)" }}>⊞</span> = 横向扩展族
            </div>
            <div>
              <span className="font-bold" style={{ color: "var(--text-deep)" }}>
                边阅读策略(大规模防乱):
              </span>
              默认只显纵向依赖骨架;单击模块进焦点模式 = 只显它的全部进出边、其余节点淡化,点空白退出;双击模块进详情;悬停边显
              reason / evidence;图例胶囊可开关边类型。
            </div>
          </div>
        </section>

        {/* 右侧模块列(按分层) */}
        <aside
          className="w-[300px] shrink-0 rounded-[14px] border p-5"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>
              模块 · 按分层
            </h2>
            <span className="text-[11px]" style={{ color: "var(--accent-text)" }}>
              共 {ov.modules} 个
            </span>
          </div>
          {orderLayers(Object.keys(ov.layers)).map((layer) => (
            <div key={layer} className="mt-3">
              <div className="mb-1.5 text-[11px] font-bold tracking-widest" style={{ color: "var(--text-3)" }}>
                {layerLabel(layer)}
              </div>
              <div className="flex flex-col gap-2">
                {(ov.layers[layer] ?? []).map((m) => (
                  <button
                    key={m.name}
                    onClick={() => onOpenModule(m.name)}
                    className="cursor-pointer rounded-lg px-3.5 py-2.5 text-left transition hover:bg-[var(--surface-hover)]"
                    style={{ background: "var(--surface-soft)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12.5px] font-semibold" style={{ color: "var(--text)" }}>
                        {m.title}
                      </span>
                      {m.extensionPoints > 0 && (
                        <span
                          className="shrink-0 rounded px-1.5 py-px text-[9.5px] font-semibold text-white"
                          style={{ background: "var(--accent)" }}
                        >
                          ⊞{m.extensionPoints}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-2)" }}>
                      {m.features} features · 出边 {m.edgesOut} / 入边 {m.edgesIn}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}



