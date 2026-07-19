/** 视图级加载 / 错误反馈(架构总览与模块详情共用;接口错误显式给文案 + 重试,不静默)。 */

export function LoadingState({ text = "加载中…" }: { text?: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-sm" style={{ color: "var(--text-3)" }}>
      {text}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-[14px] border px-6 py-10"
      style={{ background: "var(--elevated)", borderColor: "var(--border)" }}
    >
      <div className="text-sm font-bold" style={{ color: "var(--danger)" }}>
        接口请求失败
      </div>
      <div className="max-w-[560px] text-center text-xs leading-5" style={{ color: "var(--text-2)" }}>
        {message} —— 请确认 MemoryHub 服务在线后重试。
      </div>
      <button
        onClick={onRetry}
        className="cursor-pointer rounded-lg border px-4 py-1.5 text-xs font-semibold"
        style={{ borderColor: "var(--accent-border)", color: "var(--accent-text)", background: "var(--accent-soft)" }}
      >
        重试
      </button>
    </div>
  );
}
