const KEY = "app_logs";

function readLogs() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLogs(arr) {
  try {
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch { }
}

function push(level, message, meta) {
  const arr = readLogs();
  arr.push({ ts: new Date().toISOString(), level, message, meta: meta ?? null });
  if (arr.length > 1000) arr.splice(0, arr.length - 1000);
  writeLogs(arr);
}

export const appLog = {
  info: (m, meta) => push("info", m, meta),
  warn: (m, meta) => push("warn", m, meta),
  error: (m, meta) => push("error", m, meta),
  get: () => readLogs(),
  clear: () => writeLogs([]),
};

try {
  window.appLog = appLog;
} catch { }

try {
  window.addEventListener("error", (e) => {
    push("error", e.message || "Script error", {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    push("error", "Unhandled rejection", { reason: String(e.reason) });
  });
} catch { }
