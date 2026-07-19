/** 模块详情:头卡(layer/approved 徽章 + summary + 关键资产 + 查影响面)+ 左列 features 折叠面板
 *  与扩展点区块 + 右列出/入关系边;本页只读,权威 = module md 文件。 */
import { useEffect, useState, type ReactNode } from "react";

import { api, type ExtensionPoint, type Feature, type ModuleDetail } from "../api";
import { edgeStyleOf } from "../components/archShared";
import { ErrorState, LoadingState } from "../components/Feedback";

const MONO = "Consolas, Menlo, monospace";

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
        {k}
      </div>
      <div className="mt-0.5 text-xs leading-5" style={{ color: "var(--text-deep)" }}>
        {v}
      </div>
    </div>
  );
}

function FeaturePanel({
  f,
  open,
  onToggle,
  onOpenDoc,
}: {
  f: Feature;
  open: boolean;
  onToggle: () => void;
  onOpenDoc: (n: string) => void;
}) {
  return (
    <div className="rounded-[10px]" style={{ background: "var(--surface-soft)" }}>
      <button onClick={onToggle} className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left">
        <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
          {open ? "▾" : "▸"} {f.title}
        </span>
        <span
          className="ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10.5px]"
          style={{ background: "var(--elevated)", borderColor: "var(--border)", color: "var(--text-2)" }}
        >
          id: {f.id}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          <KV k="需求细节" v={f.requirement} />
          <KV k="逻辑细节(不变量)" v={f.logic} />
          {f.memoryRefs.length > 0 && (
            <div>
              <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
                关联记忆
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {f.memoryRefs.map((r) => (
                  <button
                    key={r}
                    onClick={() => onOpenDoc(r)}
                    className="cursor-pointer text-[11.5px] underline decoration-dotted underline-offset-2"
                    style={{ color: "var(--accent-text)", fontFamily: MONO }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 扩展点区块(陶土高亮底):title / kind / anchor(mono)/ additiveNote / 实现名胶囊流 */
function ExtBlock({ points }: { points: ExtensionPoint[] }) {
  return (
    <div
      className="mt-4 rounded-[10px] border p-4"
      style={{ background: "var(--accent-soft)", borderColor: "var(--accent-border)" }}
    >
      <div className="text-[12.5px] font-bold" style={{ color: "var(--accent-text)" }}>
        ⊞ 横向扩展点({points.length})
      </div>
      {points.length === 0 && (
        <div className="mt-1 text-[11px]" style={{ color: "var(--text-2)" }}>
          本模块暂无登记扩展点——新增功能若需插入点,先考虑在别处扩展或按变更契约评估。
        </div>
      )}
      <div className="mt-2 flex flex-col gap-4">
        {points.map((p) => (
          <div key={p.id}>
            <div className="text-xs font-semibold" style={{ color: "var(--text)" }}>
              {p.title}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-deep)", fontFamily: MONO }}>
              kind: {p.kind} · anchor: {p.anchor}
              {p.implementations.length > 0 ? ` · ${p.implementations.length} 个并列实现` : ""}
            </div>
            {p.additiveNote && (
              <div className="mt-0.5 text-[10.5px] leading-4" style={{ color: "var(--text-2)" }}>
                {p.additiveNote}
              </div>
            )}
            {p.implementations.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {p.implementations.map((im) => (
                  <span
                    key={im.name}
                    className="rounded-md border px-2 py-0.5 text-[10.5px]"
                    style={{
                      background: "var(--elevated)",
                      borderColor: "var(--accent-border-soft)",
                      color: "var(--text-deep)",
                      fontFamily: MONO,
                    }}
                  >
                    {im.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EdgeGroup({ label, empty, children }: { label: string; empty: boolean; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[11px] font-bold tracking-wide" style={{ color: "var(--text-3)" }}>
        {label}
      </div>
      {empty ? (
        <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
          (无)
        </div>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </div>
  );
}

function EdgeCard({
  type,
  peer,
  peerTitle,
  dir,
  reason,
  evidence,
  onOpen,
}: {
  type: string;
  peer: string;
  peerTitle: string;
  dir: "→" | "←";
  reason: string;
  evidence: string[];
  onOpen: (n: string) => void;
}) {
  const st = edgeStyleOf(type);
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--surface-soft)" }}>
      <div className="flex items-center gap-2 text-xs font-semibold">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st.colorVar }} />
        <span className="shrink-0" style={{ color: "var(--text-2)" }}>
          {type} {dir}
        </span>
        <button
          onClick={() => onOpen(peer)}
          title={peer}
          className="cursor-pointer truncate underline-offset-2 hover:underline"
          style={{ color: "var(--accent-text)" }}
        >
          {peerTitle}
        </button>
      </div>
      {reason && (
        <div className="mt-1 pl-4 text-[11px] leading-4" style={{ color: "var(--text-2)" }}>
          {reason}
        </div>
      )}
      {evidence.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-4">
          {evidence.map((ev) => (
            <span
              key={ev}
              className="rounded border px-1.5 py-0.5 text-[10px]"
              style={{ borderColor: "var(--border)", background: "var(--elevated)", color: "var(--text-2)", fontFamily: MONO }}
            >
              {ev}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ModuleView({
  name,
  onOpenModule,
  onOpenImpact,
  onOpenDoc,
}: {
  name: string | null;
  onOpenModule: (n: string) => void;
  onOpenImpact: (t: string) => void;
  onOpenDoc: (n: string) => void;
}) {
  const [detail, setDetail] = useState<ModuleDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  // 模块 name → 中文 title 映射(仅美化边卡显示;拉取失败降级显示原始 name,信息不缺失)
  const [titles, setTitles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    api
      .overview()
      .then((o) => {
        const m = new Map<string, string>();
        for (const arr of Object.values(o.layers)) for (const b of arr) m.set(b.name, b.title);
        setTitles(m);
      })
      .catch(() => setTitles(new Map()));
  }, []);

  useEffect(() => {
    if (!name) return;
    let alive = true;
    setDetail(null);
    setErr(null);
    api
      .module(name)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        const first = d.features?.[0];
        setOpenIds(new Set(first ? [first.id] : []));
      })
      .catch((e: unknown) => {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [name, tick]);

  if (!name) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold"
          style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
        >
          ▦
        </div>
        <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          尚未选择模块
        </div>
        <div className="max-w-[380px] text-center text-xs leading-5" style={{ color: "var(--text-3)" }}>
          请先到「架构总览」:在泳道图中双击模块节点,或点击右侧按分层模块列表,即可进入对应模块的详情页。
        </div>
      </div>
    );
  }

  if (err) return <ErrorState message={`模块「${name}」详情加载失败:${err}`} onRetry={() => setTick((t) => t + 1)} />;
  if (!detail) return <LoadingState text="正在加载模块详情…" />;

  const features = detail.features ?? [];
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const titleOf = (n: string) => titles.get(n) ?? n;

  return (
    <div className="flex flex-col gap-4">
      {/* 面包屑 */}
      <div className="text-xs" style={{ color: "var(--text-3)" }}>
        架构总览 / {detail.layer}
        <span className="font-semibold" style={{ color: "var(--accent-text)" }}> / {detail.title}</span>
      </div>

      {/* 模块头卡 */}
      <section
        className="rounded-[14px] border p-6"
        style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>
            {detail.title}
          </h1>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
          >
            {detail.layer}
          </span>
          {detail.approved ? (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: "color-mix(in srgb, var(--success) 14%, transparent)", color: "var(--success)" }}
            >
              ✓ approved {detail.approved}
            </span>
          ) : (
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: "var(--surface-soft)", color: "var(--text-3)" }}
            >
              未 approved
            </span>
          )}
          <button
            onClick={() => onOpenImpact(detail.name)}
            className="ml-auto cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            查此模块影响面 →
          </button>
        </div>
        <p className="mt-3 text-[13px] leading-6" style={{ color: "var(--text-deep)" }}>
          {detail.summary}
        </p>
        {detail.keyAssets.length > 0 && (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              关键资产
            </span>
            {detail.keyAssets.map((a) => (
              <span key={a} className="text-[11.5px]" style={{ color: "var(--text-2)", fontFamily: MONO }}>
                {a}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="flex items-start gap-4">
        {/* 左列:features 折叠面板 + 扩展点区块 */}
        <section
          className="min-w-0 flex-1 rounded-[14px] border p-5"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          <div className="mb-3 flex flex-wrap items-baseline gap-3">
            <h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>
              Features({features.length})
            </h2>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              需求细节 requirement / 逻辑细节 logic · 点击标题展开
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {features.map((f) => (
              <FeaturePanel key={f.id} f={f} open={openIds.has(f.id)} onToggle={() => toggle(f.id)} onOpenDoc={onOpenDoc} />
            ))}
            {features.length === 0 && (
              <div className="text-xs" style={{ color: "var(--text-3)" }}>
                本模块暂未登记 features。
              </div>
            )}
          </div>
          <ExtBlock points={detail.extensionPoints} />
        </section>

        {/* 右列:关系边 */}
        <aside
          className="w-[380px] shrink-0 rounded-[14px] border p-5"
          style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
        >
          <h2 className="mb-3 text-sm font-bold" style={{ color: "var(--text)" }}>
            关系边
          </h2>
          <EdgeGroup label="出边(此模块影响 / 依赖谁)" empty={detail.edgesOut.length === 0}>
            {detail.edgesOut.map((e, i) => (
              <EdgeCard
                key={`out-${e.type}-${e.target}-${i}`}
                type={e.type} peer={e.target} peerTitle={titleOf(e.target)} dir="→"
                reason={e.reason} evidence={e.evidence} onOpen={onOpenModule}
              />
            ))}
          </EdgeGroup>
          <EdgeGroup label="入边(谁依赖 / 影响此模块)" empty={detail.edgesIn.length === 0}>
            {detail.edgesIn.map((e, i) => (
              <EdgeCard
                key={`in-${e.type}-${e.from}-${i}`}
                type={e.type} peer={e.from} peerTitle={titleOf(e.from)} dir="←"
                reason={e.reason} evidence={e.evidence} onOpen={onOpenModule}
              />
            ))}
          </EdgeGroup>
          <div
            className="mt-5 border-t pt-3 text-[11.5px] leading-5"
            style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
          >
            <div className="mb-1 text-[11px] font-bold tracking-wide" style={{ color: "var(--text-3)" }}>
              编辑说明
            </div>
            本页只读——边与 features 的增改走 AI 沉淀流程,或直改 {detail.docName}.md(权威 = 文件)。
          </div>
        </aside>
      </div>
    </div>
  );
}



