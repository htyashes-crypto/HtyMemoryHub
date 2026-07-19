import { useCallback, useEffect, useState } from "react";
import { marked } from "marked";

import { api, type SearchHit, type SearchResult } from "../api";

/* 固定组名列表(记忆库顶层组;index_8 已随 Hephaestus 迁出本工程,无此组) */
const GROUPS = [
  "index_0_set_core",
  "index_1_set_network",
  "index_2_set_ui_editor",
  "index_3_set_framework",
  "index_4_set_misc",
  "index_5_mod",
  "index_6_blueprint",
  "index_7_display_runtime",
  "index_9_localization",
  "index_10_telemetry",
  "index_11_legion",
  "index_12_architecture",
];

const TYPES = ["feedback", "project", "reference", "user"];

const MODES = [
  { key: "hybrid", label: "混合" },
  { key: "vector", label: "语义" },
  { key: "keyword", label: "关键词" },
] as const;

/* snippet 高亮:«词» 按分段用 React 文本节点渲染并染色(不走 innerHTML,天然防注入) */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/«([^»]*)»/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-bold" style={{ color: "var(--accent-text)" }}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function ResultCard({
  hit,
  selected,
  maxScore,
  onSelect,
}: {
  hit: SearchHit;
  selected: boolean;
  maxScore: number;
  onSelect: () => void;
}) {
  const pct = Math.max(6, Math.round((hit.score / (maxScore || 1)) * 100));
  return (
    <div
      onClick={onSelect}
      className="cursor-pointer rounded-[10px] border px-3.5 py-3"
      style={
        selected
          ? { background: "var(--accent-soft)", borderColor: "var(--accent-border)" }
          : { background: "var(--surface-soft)", borderColor: "transparent" }
      }
    >
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-bold" title={hit.name}>
          {hit.name}
        </span>
        <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full" style={{ background: "var(--surface-hover)" }}>
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
        </span>
        <span className="w-9 shrink-0 text-right text-[10px]" style={{ color: "var(--text-3)" }}>
          {hit.score.toFixed(2)}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <span
          className="rounded-full border px-2 py-0.5 text-[10.5px]"
          style={{ background: "var(--elevated)", borderColor: "var(--accent-border-soft)", color: "var(--text-2)" }}
        >
          {hit.group} · {hit.type}
        </span>
        {hit.modules.map((m) => (
          <span
            key={m}
            className="rounded-full px-2 py-0.5 text-[10.5px]"
            style={{ background: "var(--accent-soft)", color: "var(--text-2)" }}
          >
            ⊂ {m}
          </span>
        ))}
      </div>
      {hit.description && (
        <div className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          {hit.description}
        </div>
      )}
      {hit.snippet && (
        <div className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--text-deep)" }}>
          <Snippet text={hit.snippet} />
        </div>
      )}
    </div>
  );
}

interface Preview {
  name: string;
  group: string;
  modules: string[];
  body: string;
}

export default function SearchView({ previewDoc }: { previewDoc: string | null }) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<string>("hybrid");
  const [group, setGroup] = useState("");
  const [mtype, setMtype] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const runSearch = useCallback((qv: string, mv: string, gv: string, tv: string) => {
    const query = qv.trim();
    if (!query) return;
    setSearching(true);
    setSearchError(null);
    const t0 = performance.now();
    api
      .search(query, mv, 20, gv || undefined, tv || undefined)
      .then((r) => {
        setResult(r);
        setElapsed(Math.round(performance.now() - t0));
      })
      .catch((e) => {
        setResult(null);
        setElapsed(null);
        const msg = (e as Error).message;
        setSearchError(
          mv === "keyword" ? `检索失败:${msg}` : `检索失败:${msg}(embedding 可能不可用,可切「关键词」模式)`,
        );
      })
      .finally(() => setSearching(false));
  }, []);

  const loadDoc = useCallback((name: string, groupHint?: string, modulesHint?: string[]) => {
    setPreviewLoading(true);
    setPreviewError(null);
    api
      .doc(name)
      .then((d) =>
        setPreview({
          name: d.name,
          group: groupHint ?? d.path.split(/[\\/]/)[0] ?? "",
          modules: modulesHint ?? [],
          body: d.body,
        }),
      )
      .catch((e) => {
        setPreview(null);
        setPreviewError(`全文加载失败:${(e as Error).message}`);
      })
      .finally(() => setPreviewLoading(false));
  }, []);

  /* 跨视图跳转:previewDoc 非空时自动加载该记忆全文 */
  useEffect(() => {
    if (previewDoc) {
      setSelectedName(previewDoc);
      loadDoc(previewDoc);
    }
  }, [previewDoc, loadDoc]);

  const selectHit = (hit: SearchHit) => {
    setSelectedName(hit.name);
    loadDoc(hit.name, hit.group, hit.modules);
  };

  const changeMode = (m: string) => {
    setMode(m);
    if (q.trim()) runSearch(q, m, group, mtype);
  };
  const changeGroup = (g: string) => {
    setGroup(g);
    if (q.trim()) runSearch(q, mode, g, mtype);
  };
  const changeType = (t: string) => {
    setMtype(t);
    if (q.trim()) runSearch(q, mode, group, t);
  };

  const maxScore = result ? Math.max(...result.results.map((r) => r.score), 0) : 0;

  return (
    <div className="flex h-full min-h-[480px] flex-col gap-4">
      {/* 搜索条 */}
      <div
        className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border px-5 py-3.5"
        style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) runSearch(q, mode, group, mtype);
          }}
          placeholder="输入自然语言或关键词,Enter 检索"
          className="min-w-[220px] flex-1 rounded-lg border px-3.5 py-2 text-[13px] outline-none"
          style={{ background: "var(--bg)", borderColor: "var(--accent-border)", color: "var(--text)" }}
        />
        <div className="flex gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => changeMode(m.key)}
              className={
                "cursor-pointer rounded-full border px-3 py-1.5 text-[11.5px] whitespace-nowrap" +
                (mode === m.key ? " text-white" : "")
              }
              style={
                mode === m.key
                  ? { background: "var(--accent)", borderColor: "var(--accent)", fontWeight: 600 }
                  : { borderColor: "var(--border)", color: "var(--text-3)" }
              }
            >
              {m.label}
              {mode === m.key ? " ✓" : ""}
            </button>
          ))}
        </div>
        <select
          value={group}
          onChange={(e) => changeGroup(e.target.value)}
          className="cursor-pointer rounded-md border px-2 py-1.5 text-[11.5px] outline-none"
          style={{ background: "var(--elevated)", borderColor: "var(--border)", color: "var(--text-2)" }}
        >
          <option value="">组:全部</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={mtype}
          onChange={(e) => changeType(e.target.value)}
          className="cursor-pointer rounded-md border px-2 py-1.5 text-[11.5px] outline-none"
          style={{ background: "var(--elevated)", borderColor: "var(--border)", color: "var(--text-2)" }}
        >
          <option value="">类型:全部</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {elapsed !== null && (
          <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--text-3)" }}>
            耗时 {elapsed}ms
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        {/* 左:结果列表 */}
        <div
          className="flex min-h-[200px] flex-col rounded-[14px] border p-4 lg:w-[46%]"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          <div className="mb-3 flex items-baseline gap-2.5 px-1">
            <span className="text-[14px] font-bold tracking-wide">
              结果{result ? ` · ${result.results.length} 条` : ""}
            </span>
            {result && (
              <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                {MODES.find((m) => m.key === result.mode)?.label ?? result.mode}模式
              </span>
            )}
          </div>
          {searchError && (
            <div
              className="mb-2.5 rounded-lg border px-3.5 py-3 text-xs leading-relaxed"
              style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border-soft)", color: "var(--danger)" }}
            >
              {searchError}
            </div>
          )}
          <div className="min-h-0 flex-1 space-y-2.5 overflow-auto pr-1">
            {searching && (
              <div className="py-8 text-center text-xs" style={{ color: "var(--text-3)" }}>
                检索中…
              </div>
            )}
            {!searching && !result && !searchError && (
              <div className="py-8 text-center text-xs" style={{ color: "var(--text-3)" }}>
                输入关键词后回车开始检索,与 AI 的 memory_search 同数据源。
              </div>
            )}
            {!searching && result && result.results.length === 0 && (
              <div className="py-8 text-center text-xs" style={{ color: "var(--text-3)" }}>
                无匹配结果,试试换个说法或切换模式。
              </div>
            )}
            {!searching &&
              result &&
              result.results.map((hit) => (
                <ResultCard
                  key={hit.name}
                  hit={hit}
                  selected={selectedName === hit.name}
                  maxScore={maxScore}
                  onSelect={() => selectHit(hit)}
                />
              ))}
          </div>
        </div>

        {/* 右:全文预览 */}
        <div
          className="flex min-h-[200px] min-w-0 flex-1 flex-col rounded-[14px] border p-5"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          {previewLoading && (
            <div className="py-8 text-center text-xs" style={{ color: "var(--text-3)" }}>
              全文加载中…
            </div>
          )}
          {!previewLoading && previewError && (
            <div
              className="rounded-lg border px-3.5 py-3 text-xs"
              style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border-soft)", color: "var(--danger)" }}
            >
              {previewError}
            </div>
          )}
          {!previewLoading && !previewError && !preview && (
            <div className="py-8 text-center text-xs" style={{ color: "var(--text-3)" }}>
              点击左侧结果查看记忆全文。
            </div>
          )}
          {!previewLoading && !previewError && preview && (
            <>
              <div className="truncate font-mono text-[14px] font-bold" title={`${preview.name}.md`}>
                {preview.name}.md
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {preview.group && (
                  <span
                    className="rounded-full px-2.5 py-1 text-[10.5px]"
                    style={{ background: "var(--accent-soft)", color: "var(--text-2)" }}
                  >
                    {preview.group} 组
                  </span>
                )}
                {preview.modules.map((m) => (
                  <span
                    key={m}
                    className="rounded-full px-2.5 py-1 text-[10.5px]"
                    style={{ background: "var(--accent-soft)", color: "var(--text-2)" }}
                  >
                    挂:{m}
                  </span>
                ))}
              </div>
              <div className="mt-3 min-h-0 flex-1 overflow-auto border-t pt-2" style={{ borderColor: "var(--border-soft)" }}>
                <div
                  className="md-preview"
                  dangerouslySetInnerHTML={{ __html: marked.parse(preview.body, { async: false }) }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
