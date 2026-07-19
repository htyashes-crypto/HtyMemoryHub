/** 力导架构图(echarts 按需引入):节点按 layer 着色系,边色同泳道四色;双击节点进模块详情。
 *  canvas 不认 var(),颜色经 cssVarValue 运行时从语义 token 解析;监听 html.dark 切换重渲。 */
import { useEffect, useRef } from "react";

import { GraphChart } from "echarts/charts";
import { TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

import type { GraphEdge, GraphNode } from "../api";
import { cssVarValue, edgeStyleOf } from "./archShared";

import type { EChartsCoreOption } from "echarts/core";

echarts.use([GraphChart, TooltipComponent, CanvasRenderer]);

/** 层 → 语义色 token(节点着色系) */
const LAYER_COLOR_VAR: Record<string, string> = {
  "UI/编辑器": "--accent",
  "业务/运行时": "--success",
  "引擎/同步": "--danger",
  "基础/原子": "--text-3",
};

const EDGE_COLOR_VAR: Record<string, string> = {
  depends_on: "--edge-dep",
  affects: "--edge-aff",
  shares_state: "--edge-share",
  related: "--edge-rel",
};

function buildOption(nodes: GraphNode[], edges: GraphEdge[]): EChartsCoreOption {
  const nodeOf = new Map(nodes.map((n) => [n.name, n]));
  return {
    tooltip: {
      backgroundColor: cssVarValue("--elevated"),
      borderColor: cssVarValue("--border"),
      textStyle: { color: cssVarValue("--text"), fontSize: 11 },
      confine: true,
      // tooltip DOM 挂 body:挂容器内时其出现/消失会扰动容器布局(滚动条/尺寸微抖)
      // → ResizeObserver → resize → 力导重跑 → 整图闪烁的反馈环;脱离容器根治
      appendToBody: true,
      transitionDuration: 0,
      formatter: (p: { dataType?: string; data?: { id?: string; source?: string; target?: string; reason?: string; edgeType?: string } }) => {
        if (p.dataType === "edge" && p.data) {
          const s = nodeOf.get(p.data.source ?? "");
          const t = nodeOf.get(p.data.target ?? "");
          const head = `${edgeStyleOf(p.data.edgeType ?? "").label}:${s?.title ?? p.data.source} → ${t?.title ?? p.data.target}`;
          return p.data.reason ? `${head}<br/>${p.data.reason}` : head;
        }
        if (p.dataType === "node" && p.data?.id) {
          const n = nodeOf.get(p.data.id);
          if (n) return `${n.title}<br/>${n.layer} · 扩展点 ${n.extensionPoints} · 双击进详情`;
        }
        return "";
      },
    },
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        force: { repulsion: 320, edgeLength: 120, gravity: 0.1 },
        label: {
          show: true,
          position: "bottom",
          fontSize: 10,
          color: cssVarValue("--text-2"),
          formatter: (p: { name?: string }) => {
            const s = p.name ?? "";
            return s.length > 9 ? `${s.slice(0, 8)}…` : s;
          },
        },
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: [0, 7],
        data: nodes.map((n) => ({
          id: n.name,
          name: n.title,
          symbolSize: 22 + Math.min(n.extensionPoints, 8) * 2,
          itemStyle: { color: cssVarValue(LAYER_COLOR_VAR[n.layer] ?? "--text-2") },
        })),
        edges: edges.map((e) => ({
          source: e.src,
          target: e.target,
          reason: e.reason,
          edgeType: e.type,
          lineStyle: {
            color: cssVarValue(EDGE_COLOR_VAR[e.type] ?? "--edge-rel"),
            type: e.type === "depends_on" ? "solid" : e.type === "affects" ? "dashed" : "dotted",
            width: 1.5,
            curveness: 0.12,
          },
        })),
        emphasis: { focus: "adjacency", lineStyle: { width: 2.6 } },
      },
    ],
  };
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onOpenModule: (name: string) => void;
}

export default function ForceGraph({ nodes, edges, onOpenModule }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(onOpenModule);
  openRef.current = onOpenModule;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el);
    const render = () => chart.setOption(buildOption(nodes, edges), true);
    render();
    chart.on("dblclick", (p) => {
      const q = p as { dataType?: string; data?: { id?: string } };
      if (q.dataType === "node" && q.data?.id) openRef.current(q.data.id);
    });
    // resize 仅在尺寸真实变化(>1px)时触发——chart.resize 会重启力导迭代,
    // 微抖直通会造成整图持续跳动
    let lastW = el.clientWidth;
    let lastH = el.clientHeight;
    const ro = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = el;
      if (Math.abs(w - lastW) <= 1 && Math.abs(h - lastH) <= 1) return;
      lastW = w;
      lastH = h;
      chart.resize();
    });
    ro.observe(el);
    // 主题切换(html.dark)后 token 实际值变化,重建 option 重取色
    const mo = new MutationObserver(render);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
      chart.dispose();
    };
  }, [nodes, edges]);

  return <div ref={ref} className="h-[560px] w-full" />;
}

