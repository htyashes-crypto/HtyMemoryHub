/** 架构图共享常量:关系边四类"线型 + 箭头 + 颜色"三编码、泳道层序、CSS 变量运行时取值。 */

export interface EdgeTypeStyle {
  type: string;
  label: string;
  /** CSS 变量引用(组件一律 var(--xxx),禁 hex) */
  colorVar: string;
  /** SVG strokeDasharray,空串 = 实线 */
  dash: string;
  /** 箭头形状:实心三角 / 空心三角 / 菱形 / 无 */
  marker: "solid" | "hollow" | "diamond" | "none";
}

export const EDGE_TYPES: EdgeTypeStyle[] = [
  { type: "depends_on", label: "纵向依赖", colorVar: "var(--edge-dep)", dash: "", marker: "solid" },
  { type: "affects", label: "影响", colorVar: "var(--edge-aff)", dash: "9 5", marker: "hollow" },
  { type: "shares_state", label: "共享状态", colorVar: "var(--edge-share)", dash: "1.5 4.5", marker: "diamond" },
  { type: "related", label: "关联", colorVar: "var(--edge-rel)", dash: "4 3", marker: "none" },
];

/** 默认(非焦点)只画 depends_on 骨架边 */
export const DEFAULT_ENABLED_TYPES: string[] = ["depends_on"];

const REL_FALLBACK = EDGE_TYPES[EDGE_TYPES.length - 1];

export function edgeStyleOf(type: string): EdgeTypeStyle {
  return EDGE_TYPES.find((t) => t.type === type) ?? REL_FALLBACK;
}

/** 泳道自上而下的层序(照 mockup:UI → 业务 → 引擎 → 基础);未知层追加在末尾 */
export const LAYER_ORDER: string[] = ["UI/编辑器", "业务/运行时", "引擎/同步", "基础/原子"];

export function orderLayers(keys: string[]): string[] {
  const known = LAYER_ORDER.filter((l) => keys.includes(l));
  const extra = keys.filter((k) => !LAYER_ORDER.includes(k));
  return [...known, ...extra];
}

/** 读取 CSS 变量当前实际值(echarts canvas 不认 var(),运行时解析仍以语义 token 为唯一色源)。 */
export function cssVarValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
