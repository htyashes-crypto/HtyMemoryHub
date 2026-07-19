/** REST 封装单点:页面所有数据都走这里(与 AI 的 MCP 工具同数据源,双端一致)。 */

const BASE = ""; // dev 走 vite 代理;产物挂 /ui 下用相对路径同源访问

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(BASE + path);
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

export interface SearchHit {
  name: string;
  path: string;
  group: string;
  type: string;
  displayName: string;
  description: string;
  score: number;
  snippet: string;
  modules: string[];
  body?: string;
}

export interface SearchResult {
  query: string;
  mode: string;
  lastIndexed: string | null;
  results: SearchHit[];
}

export interface Stats {
  workspace: string;
  memoryRoot: string;
  port: number;
  docs: number;
  chunks: number;
  lastIndexed: string | null;
  embedding: { baseUrl: string; model: string; dim: number } | null;
  fingerprint: string | null;
}

export interface ModuleBrief {
  name: string;
  title: string;
  summary: string;
  features: number;
  extensionPoints: number;
  edgesOut: number;
  edgesIn: number;
}

export interface Overview {
  layers: Record<string, ModuleBrief[]>;
  modules: number;
  edges: number;
  usage: string;
}

export interface Feature {
  id: string;
  title: string;
  requirement: string;
  logic: string;
  memoryRefs: string[];
}

export interface ExtensionPoint {
  id: string;
  title: string;
  kind: string;
  anchor: string;
  additiveNote: string;
  implementations: { name: string }[];
}

export interface EdgeOut { type: string; target: string; reason: string; evidence: string[] }
export interface EdgeIn { type: string; from: string; reason: string; evidence: string[] }

export interface ModuleDetail {
  name: string;
  title: string;
  summary: string;
  layer: string;
  approved: string;
  keyAssets: string[];
  docName: string;
  features?: Feature[];
  extensionPoints: ExtensionPoint[];
  edgesOut: EdgeOut[];
  edgesIn: EdgeIn[];
}

export interface ImpactItem { module: string; type: string; reason: string; evidence: string[]; via: string }
export interface Impact {
  target: string;
  depth: number;
  edgeTypes: string[];
  affected: number;
  hops: { hop: number; items: ImpactItem[] }[];
  note: string;
}

export interface GraphNode { name: string; title: string; layer: string; extensionPoints: number }
export interface GraphEdge { src: string; type: string; target: string; reason: string; evidence: string[] }
export interface Graph { nodes: GraphNode[]; edges: GraphEdge[] }

export interface LintReport { modules: number; features: number; extensionPoints: number; edges: number; errors: string[] }

export interface FullLint {
  docs: number;
  vectorCoverage: number;
  hard: string[];
  suspects: { kind: string; subject: string; detail: string }[];
  ok: boolean;
}

export const api = {
  stats: () => get<Stats>("/stats"),
  search: (q: string, mode: string, topK: number, group?: string, mtype?: string) =>
    get<SearchResult>(
      `/search?q=${encodeURIComponent(q)}&mode=${mode}&top_k=${topK}` +
        (group ? `&group=${encodeURIComponent(group)}` : "") +
        (mtype ? `&type=${encodeURIComponent(mtype)}` : ""),
    ),
  doc: (name: string) => get<{ name: string; path: string; body: string }>(`/doc/${encodeURIComponent(name)}`),
  overview: () => get<Overview>("/arch/overview"),
  module: (name: string) => get<ModuleDetail>(`/arch/module/${encodeURIComponent(name)}`),
  impact: (target: string, depth: number) =>
    get<Impact>(`/arch/impact?target=${encodeURIComponent(target)}&depth=${depth}`),
  graph: () => get<Graph>("/arch/graph"),
  lint: () => get<LintReport>("/arch/lint"),
  fullLint: () => get<FullLint>("/lint"),
  setCaptureMode: (value: string) =>
    fetch("/capture-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
  reindex: () => fetch("/reindex?keyword_only=false", { method: "POST" }).then((r) => r.json()),
};
