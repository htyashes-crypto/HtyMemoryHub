import { useEffect, useState } from "react";

import { api, type Stats } from "./api";
import HealthView from "./views/HealthView";
import ImpactView from "./views/ImpactView";
import ModuleView from "./views/ModuleView";
import OverviewView from "./views/OverviewView";
import SearchView from "./views/SearchView";

const NAV = [
  { key: "overview", label: "架构总览" },
  { key: "module", label: "模块详情" },
  { key: "impact", label: "影响面分析" },
  { key: "search", label: "记忆检索" },
  { key: "health", label: "库健康" },
] as const;

type ViewKey = (typeof NAV)[number]["key"];

export default function App() {
  const [view, setView] = useState<ViewKey>("overview");
  // 跨视图跳转载荷:总览点模块→详情;详情点"查影响面"→影响面;检索预览记忆名
  const [moduleName, setModuleName] = useState<string | null>(null);
  const [impactTarget, setImpactTarget] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem("memoryhub-theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("memoryhub-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null));
  }, [view]);

  const openModule = (name: string) => {
    setModuleName(name);
    setView("module");
  };
  const openImpact = (target: string) => {
    setImpactTarget(target);
    setView("impact");
  };
  const openDoc = (name: string) => {
    setPreviewDoc(name);
    setView("search");
  };

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏 */}
      <header
        className="flex h-[52px] shrink-0 items-center gap-3 border-b px-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md text-[13px] font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          M
        </div>
        <span className="text-[15px] font-bold">MemoryHub</span>
        {stats && (
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            工作区:{stats.workspace}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: "var(--text-2)" }}>
          {stats ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--success)" }} />
              索引 {stats.docs} docs · {stats.lastIndexed ? new Date(stats.lastIndexed).toLocaleTimeString() : "-"}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--danger)" }} />
              服务离线
            </span>
          )}
          <button
            onClick={() => setDark(!dark)}
            className="cursor-pointer rounded-full border px-3 py-1"
            style={{ borderColor: "var(--border)", background: "var(--surface-soft)" }}
          >
            {dark ? "深色 ✓" : "奶油 ✓"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 侧边栏 */}
        <aside
          className="flex w-[200px] shrink-0 flex-col border-r py-6"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              className="relative mx-2 cursor-pointer rounded-lg px-4 py-2 text-left text-[13px]"
              style={
                view === n.key
                  ? { background: "var(--accent-soft)", color: "var(--accent-text)", fontWeight: 700 }
                  : { color: "var(--text-2)" }
              }
            >
              {view === n.key && (
                <span
                  className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded"
                  style={{ background: "var(--accent)" }}
                />
              )}
              {n.label}
            </button>
          ))}
          <div className="mx-4 mt-4 border-t pt-4 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>
            <div className="mb-1.5">记忆层级</div>
            <div style={{ color: "var(--text-deep)" }}>① 最高铁律</div>
            <div style={{ color: "var(--accent-text)", fontWeight: 600 }}>② 图谱结构</div>
            <div style={{ color: "var(--text-deep)" }}>③ 系统内部细节</div>
          </div>
        </aside>

        {/* 主区 */}
        <main className="min-w-0 flex-1 overflow-auto p-6">
          {view === "overview" && <OverviewView onOpenModule={openModule} />}
          {view === "module" && (
            <ModuleView name={moduleName} onOpenModule={openModule} onOpenImpact={openImpact} onOpenDoc={openDoc} />
          )}
          {view === "impact" && <ImpactView initialTarget={impactTarget} onOpenModule={openModule} />}
          {view === "search" && <SearchView previewDoc={previewDoc} />}
          {view === "health" && <HealthView />}
        </main>
      </div>
    </div>
  );
}
