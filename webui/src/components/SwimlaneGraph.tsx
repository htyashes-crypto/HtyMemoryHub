/** 分层泳道架构图(SVG 自绘):
 *  规模化策略——默认只画 depends_on 骨架边;单击节点进焦点模式只显该节点全部相关边,
 *  无关节点淡化,点空白退出;边走泳道间正交通道(同通道错开),线型 + 箭头 + 颜色三编码。 */
import { useMemo, useRef, useState } from "react";

import type { GraphEdge } from "../api";
import { edgeStyleOf } from "./archShared";

export interface LaneNodeData {
  name: string;
  title: string;
  sub: string;
  extensionPoints: number;
}

export interface LaneData {
  layer: string;
  nodes: LaneNodeData[];
}

interface Props {
  lanes: LaneData[];
  /** 已按焦点 + 图例类型过滤后的可见边 */
  edges: GraphEdge[];
  focus: string | null;
  /** 焦点态需淡化的节点名集合(null = 非焦点态) */
  dimmed: Set<string> | null;
  onFocus: (name: string | null) => void;
  onOpenModule: (name: string) => void;
}

const VB_W = 1000;
const PAD_X = 10;
const LANE_PAD_X = 14;
const LANE_LABEL_H = 24;
const LANE_PAD_B = 12;
const NODE_W = 178;
const NODE_H = 46;
const GAP_X = 12;
const GAP_Y = 14;
const CHANNEL_H = 34;

interface PlacedNode extends LaneNodeData {
  x: number;
  y: number;
  laneIdx: number;
}

interface LaneRect {
  layer: string;
  y: number;
  h: number;
}

interface EdgeGeom {
  edge: GraphEdge;
  d: string;
  ports: { x: number; y: number }[];
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** 正交折线:从 (x1,y1) 垂直进通道 cy,水平走位,再垂直落到 (x2,y2);转角 6px 圆角。 */
function orthPath(x1: number, y1: number, x2: number, y2: number, cy: number): string {
  const r = 6;
  if (Math.abs(x2 - x1) < r * 2 + 2) return `M ${x1} ${y1} L ${x1} ${cy} L ${x2} ${y2}`;
  const sx = x2 > x1 ? 1 : -1;
  const s1 = cy > y1 ? 1 : -1;
  const s2 = y2 > cy ? 1 : -1;
  return (
    `M ${x1} ${y1} V ${cy - s1 * r} Q ${x1} ${cy} ${x1 + sx * r} ${cy} ` +
    `H ${x2 - sx * r} Q ${x2} ${cy} ${x2} ${cy + s2 * r} V ${y2}`
  );
}

/** 同节点同侧多端口的横向错开序列 */
const PORT_SEQ = [0, -18, 18, -36, 36, -54, 54];

export default function SwimlaneGraph({ lanes, edges, focus, dimmed, onFocus, onOpenModule }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; edge: GraphEdge } | null>(null);

  // 布局:泳道纵向堆叠,泳道内节点按固定列数折行;每条泳道下方留一条水平边通道
  const layout = useMemo(() => {
    const laneRects: LaneRect[] = [];
    const nodes = new Map<string, PlacedNode>();
    const channelY: number[] = [];
    const innerW = VB_W - PAD_X * 2 - LANE_PAD_X * 2;
    const perRow = Math.max(1, Math.floor((innerW + GAP_X) / (NODE_W + GAP_X)));
    let cursor = 4;
    lanes.forEach((lane, li) => {
      const rows = Math.max(1, Math.ceil(lane.nodes.length / perRow));
      const h = LANE_LABEL_H + rows * NODE_H + (rows - 1) * GAP_Y + LANE_PAD_B;
      laneRects.push({ layer: lane.layer, y: cursor, h });
      lane.nodes.forEach((n, i) => {
        const row = Math.floor(i / perRow);
        const col = i % perRow;
        nodes.set(n.name, {
          ...n,
          x: PAD_X + LANE_PAD_X + col * (NODE_W + GAP_X),
          y: cursor + LANE_LABEL_H + row * (NODE_H + GAP_Y),
          laneIdx: li,
        });
      });
      cursor += h;
      channelY.push(cursor + CHANNEL_H / 2);
      cursor += CHANNEL_H;
    });
    return { laneRects, nodes, channelY, totalH: cursor };
  }, [lanes]);

  // 边几何:垂直落位 + 目标侧泳道通道水平走位;端口 / 通道内序号错开防重叠
  const geoms = useMemo<EdgeGeom[]>(() => {
    const { nodes, channelY } = layout;
    const portUse = new Map<string, number>();
    const chanUse = new Map<number, number>();
    const takePort = (n: PlacedNode, side: string): number => {
      const key = `${n.name}:${side}`;
      const k = portUse.get(key) ?? 0;
      portUse.set(key, k + 1);
      const half = NODE_W / 2 - 10;
      const off = PORT_SEQ[k % PORT_SEQ.length];
      return n.x + NODE_W / 2 + Math.max(-half, Math.min(half, off));
    };
    const takeChan = (c: number): number => {
      const k = chanUse.get(c) ?? 0;
      chanUse.set(c, k + 1);
      return (channelY[c] ?? 0) - 12 + (k % 5) * 6;
    };
    const out: EdgeGeom[] = [];
    for (const e of edges) {
      const a = nodes.get(e.src);
      const b = nodes.get(e.target);
      if (!a || !b) continue;
      let y1: number;
      let y2: number;
      let ch: number;
      if (a.laneIdx < b.laneIdx) {
        y1 = a.y + NODE_H; y2 = b.y; ch = b.laneIdx - 1; // 下行:走目标泳道上方通道
      } else if (a.laneIdx > b.laneIdx) {
        y1 = a.y; y2 = b.y + NODE_H; ch = b.laneIdx; // 上行:走目标泳道下方通道
      } else {
        y1 = a.y + NODE_H; y2 = b.y + NODE_H; ch = a.laneIdx; // 同层:从本泳道下方通道绕行
      }
      const x1 = takePort(a, y1 === a.y ? "t" : "b");
      const x2 = takePort(b, y2 === b.y ? "t" : "b");
      out.push({ edge: e, d: orthPath(x1, y1, x2, y2, takeChan(ch)), ports: [{ x: x1, y: y1 }, { x: x2, y: y2 }] });
    }
    return out;
  }, [edges, layout]);

  const titleOf = (n: string) => layout.nodes.get(n)?.title ?? n;

  const moveTip = (edge: GraphEdge) => (ev: { clientX: number; clientY: number }) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    setTip({
      x: Math.max(0, Math.min(ev.clientX - r.left + 14, r.width - 310)),
      y: ev.clientY - r.top + 14,
      edge,
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <svg viewBox={`0 0 ${VB_W} ${layout.totalH}`} className="block w-full" onClick={() => onFocus(null)}>
        <defs>
          <marker id="arr-solid" markerWidth={9} markerHeight={8} refX={7.6} refY={4} orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L8,4 L0,8 Z" style={{ fill: "var(--edge-dep)" }} />
          </marker>
          <marker id="arr-hollow" markerWidth={11} markerHeight={10} refX={8.4} refY={5} orient="auto" markerUnits="userSpaceOnUse">
            <path d="M1,1 L8.4,5 L1,9 Z" style={{ fill: "var(--elevated)", stroke: "var(--edge-aff)" }} strokeWidth={1.4} />
          </marker>
          <marker id="arr-diamond" markerWidth={10} markerHeight={9} refX={8.6} refY={4.5} orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0.6,4.5 L4.8,1 L9,4.5 L4.8,8 Z" style={{ fill: "var(--edge-share)" }} />
          </marker>
        </defs>

        {/* 泳道底(交替底色)与层标签 */}
        {layout.laneRects.map((lr, i) => (
          <g key={lr.layer}>
            <rect
              x={PAD_X} y={lr.y} width={VB_W - PAD_X * 2} height={lr.h} rx={10}
              style={{ fill: i % 2 === 0 ? "var(--bg)" : "var(--surface)" }} opacity={i % 2 === 0 ? 1 : 0.55}
            />
            <text
              x={PAD_X + 12} y={lr.y + 16} fontSize={11} fontWeight={700} letterSpacing={1}
              style={{ fill: "var(--text-3)" }}
            >
              {`${lr.layer.split("/").join(" / ")}层`}
            </text>
          </g>
        ))}

        {/* 边:主线(线型 + 箭头双编码)+ 端口点 + 透明命中线(悬停显 reason / evidence) */}
        {geoms.map((g, i) => {
          const st = edgeStyleOf(g.edge.type);
          return (
            <g key={`${g.edge.src}|${g.edge.target}|${g.edge.type}|${i}`}>
              <path
                d={g.d} fill="none" style={{ stroke: st.colorVar }}
                strokeWidth={g.edge.type === "depends_on" ? 1.6 : 1.8}
                strokeDasharray={st.dash || undefined}
                strokeLinecap={g.edge.type === "shares_state" ? "round" : undefined}
                markerEnd={st.marker === "none" ? undefined : `url(#arr-${st.marker})`}
              />
              {g.ports.map((p, j) => (
                <circle key={j} cx={p.x} cy={p.y} r={2.4} style={{ fill: st.colorVar }} />
              ))}
              <path
                d={g.d} fill="none" stroke="transparent" strokeWidth={11}
                onMouseMove={moveTip(g.edge)} onMouseLeave={() => setTip(null)}
              />
            </g>
          );
        })}

        {/* 节点:圆角矩形 + ⊞N 扩展点徽章;单击聚焦,双击进模块详情;焦点态无关节点淡化 */}
        {[...layout.nodes.values()].map((n) => {
          const isFocus = focus === n.name;
          const isDim = dimmed?.has(n.name) ?? false;
          const badgeText = `⊞${n.extensionPoints}`;
          const hasBadge = n.extensionPoints > 0;
          const bw = 12 + badgeText.length * 7;
          return (
            <g
              key={n.name}
              transform={`translate(${n.x},${n.y})`}
              style={{ cursor: "pointer", opacity: isDim ? 0.3 : 1, transition: "opacity .15s" }}
              onClick={(e) => { e.stopPropagation(); onFocus(n.name); }}
              onDoubleClick={(e) => { e.stopPropagation(); onOpenModule(n.name); }}
            >
              {isFocus && (
                <rect
                  x={-5} y={-5} width={NODE_W + 10} height={NODE_H + 10} rx={11} fill="none"
                  style={{ stroke: "var(--accent)" }} strokeWidth={2} opacity={0.55}
                />
              )}
              <rect
                width={NODE_W} height={NODE_H} rx={8}
                style={{
                  fill: isFocus ? "var(--accent-soft)" : "var(--elevated)",
                  stroke: isFocus ? "var(--accent)" : "var(--accent-border)",
                }}
                strokeWidth={isFocus ? 2 : 1.2}
              />
              <text x={10} y={19} fontSize={11.5} fontWeight={isFocus ? 700 : 600} style={{ fill: "var(--text)" }}>
                {clip(n.title, hasBadge ? 10 : 13)}
              </text>
              <text x={10} y={36} fontSize={10} style={{ fill: "var(--text-2)" }}>
                {n.sub}
              </text>
              {hasBadge && (
                <g>
                  <rect x={NODE_W - bw - 6} y={6} width={bw} height={17} rx={4} style={{ fill: "var(--accent)" }} />
                  <text x={NODE_W - 6 - bw / 2} y={18.5} fontSize={10.5} textAnchor="middle" className="fill-white">
                    {badgeText}
                  </text>
                </g>
              )}
              <title>{`${n.title} —— 单击聚焦 / 双击打开模块详情`}</title>
            </g>
          );
        })}
      </svg>

      {/* 边悬停浮层 */}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-[300px] rounded-lg border px-3 py-2 text-[11px] leading-4 shadow-lg"
          style={{ left: tip.x, top: tip.y, background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--text)" }}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: edgeStyleOf(tip.edge.type).colorVar }} />
            {edgeStyleOf(tip.edge.type).label} · {titleOf(tip.edge.src)} → {titleOf(tip.edge.target)}
          </div>
          {tip.edge.reason && (
            <div className="mt-1" style={{ color: "var(--text-2)" }}>
              {tip.edge.reason}
            </div>
          )}
          {tip.edge.evidence.length > 0 && (
            <div className="mt-1" style={{ color: "var(--accent-text)" }}>
              证据:{tip.edge.evidence.join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}



