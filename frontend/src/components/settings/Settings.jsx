import { useEffect, useState } from "react";
import "./settings.css";

export default function Settings() {
  const [companyName, setCompanyName] = useState(() => localStorage.getItem("company_name") || "");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  const [dbStatus, setDbStatus] = useState({ loading: false, message: "", type: "" });

  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState("");

  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    refreshLogs();
  }, []);

  const saveBasics = () => {
    localStorage.setItem("company_name", companyName);
    alert("Zapisano nazwę firmy!");
  };

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };

  const testDbConnection = async () => {
    setDbStatus({ loading: true, message: "Sprawdzanie...", type: "" });

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/db-test`);
      const data = await res.json();

      if (res.ok) {
        setDbStatus({
          loading: false,
          message: `Połączono! Czas serwera: ${data.now || "OK"}`,
          type: "success"
        });
      } else {
        throw new Error(data.error || "Błąd API");
      }
    } catch (err) {
      setDbStatus({
        loading: false,
        message: "Błąd połączenia z bazą: " + err.message,
        type: "error"
      });
    }
  };

  const clearLocalStorage = () => {
    if (window.confirm("Uwaga! To usunie wszystkie lokalne ustawienia (oprócz logowania). Kontynuować?")) {
      const auth = localStorage.getItem("auth");
      localStorage.clear();
      if (auth) localStorage.setItem("auth", auth);

      alert("Wyczyszczono dane lokalne.");
      window.location.reload();
    }
  };

  const handleLogout = () => {
    if (window.confirm("Czy na pewno chcesz się wylogować?")) {
      localStorage.removeItem("auth");
      window.location.href = "/login";
    }
  };

  const refreshLogs = () => {
    try {
      if (window.appLog && typeof window.appLog.get === 'function') {
        setLogs(window.appLog.get());
      } else {
        console.log("Brak systemu logów (window.appLog), wyświetlam puste.");
        setLogs([]);
      }
    } catch (e) {
      setLogs([]);
    }
  };

  const downloadLogs = () => {
    if (logs.length === 0) return alert("Brak logów do pobrania.");

    const textContent = logs.map(l => `[${l.ts}] [${l.level}] ${l.message}`).join("\n");
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredLogs = logs.filter(l =>
    !logFilter ||
    (l.message && l.message.toLowerCase().includes(logFilter.toLowerCase()))
  );

  return (
    <div className="settings-container">
      <h1 className="settings-header">Ustawienia Aplikacji</h1>

      <div className="settings-grid">

        <div className="settings-card">
          <h2 className="settings-title">Firma</h2>
          <label className="settings-label">Nazwa wyświetlana w nagłówku</label>
          <input
            className="settings-input"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="np. Serwis Komputerowy"
          />
          <button className="btn btn-primary" onClick={saveBasics}>Zapisz</button>
        </div>

        <div className="settings-card">
          <h2 className="settings-title">Wygląd</h2>
          <p>Aktualny motyw: <strong>{theme === "dark" ? "Ciemny" : "Jasny"}</strong></p>
          <button className="btn btn-secondary" onClick={toggleTheme}>
            Przełącz tryb {theme === "dark" ? "Jasny ☀️" : "Ciemny 🌙"}
          </button>
        </div>

        <div className="settings-card">
          <h2 className="settings-title">Diagnostyka</h2>
          <button className="btn btn-secondary" onClick={testDbConnection} disabled={dbStatus.loading}>
            {dbStatus.loading ? "Testowanie..." : "Test połączenia z bazą"}
          </button>

          {dbStatus.message && (
            <div className={`db-status ${dbStatus.type === 'success' ? 'db-ok' : 'db-err'}`}>
              {dbStatus.message}
            </div>
          )}
        </div>

        <div className="settings-card">
          <h2 className="settings-title">Dane lokalne</h2>
          <button className="btn btn-danger" onClick={clearLocalStorage}>
            Wyczyść cache przeglądarki
          </button>
          <div style={{ marginTop: 10, borderTop: "1px solid #eee", paddingTop: 10 }}>
            <button className="btn btn-danger" onClick={handleLogout}>
              Wyloguj się z systemu
            </button>
          </div>
        </div>

        <div className="settings-card logs-section">
          <h2 className="settings-title">Logi systemowe</h2>

          <div className="logs-toolbar">
            <input
              className="settings-input"
              placeholder="Filtruj logi..."
              value={logFilter}
              onChange={e => setLogFilter(e.target.value)}
            />
            <button className="btn btn-secondary" onClick={refreshLogs} style={{ width: "auto" }}>Odśwież</button>
            <button className="btn btn-secondary" onClick={downloadLogs} style={{ width: "auto" }}>Pobierz .txt</button>
          </div>

          <div className="logs-list">
            {filteredLogs.length > 0 ? (
              filteredLogs.slice().reverse().map((log, i) => (
                <div key={i} className="log-entry">
                  <span style={{ color: "#4ec9b0" }}>[{log.ts}]</span>{" "}
                  <span style={{ color: log.level === 'error' ? '#f44336' : '#9cdcfe' }}>[{log.level.toUpperCase()}]</span>{" "}
                  {log.message}
                </div>
              ))
            ) : (
              <div style={{ color: "#666", textAlign: "center", marginTop: 20 }}>
                Brak logów do wyświetlenia (lub system logowania wyłączony).
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}