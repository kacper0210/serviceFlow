import { useState, useEffect } from "react";

export default function KsefIntegration({ period: externalPeriod, setPeriod: externalSetPeriod }) {
  const [internalPeriod, setInternalPeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });

  const period = externalPeriod || internalPeriod;
  const setPeriod = externalSetPeriod || setInternalPeriod;

  const [settings, setSettings] = useState({
    nip: "",
    token: "",
    environment: "mock"
  });
  const [hasToken, setHasToken] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [expandedKsefRows, setExpandedKsefRows] = useState({});
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [importParams, setImportParams] = useState({ category: "Inne", isCarCost: false });
  const [importing, setImporting] = useState(false);

  const [issueParams, setIssueParams] = useState({
    contractor_name: "",
    contractor_nip: "",
    invoice_number: "",
    date: new Date().toISOString().split("T")[0],
    vat_rate: 23,
    send_to_ksef: true,
    items: [
      { description: "Usługa serwisowa / wykonawcza", quantity: 1, unit_price: 100, vat_rate: 23 }
    ]
  });
  const [issuing, setIssuing] = useState(false);

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/ksef/settings`, {
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({ nip: data.nip, token: "", environment: data.environment });
        setHasToken(data.has_token);
        setLastSyncAt(data.last_sync_at);
      }
    } catch (e) {
      console.error("Failed to load KSeF settings", e);
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadInvoicesFromDb = async () => {
    setLoadingInvoices(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/ksef/invoices?year=${period.year}&month=${period.month}`,
        { headers: { "Authorization": `Bearer ${authData?.token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (e) {
      console.error("Failed to load invoices from DB", e);
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    loadInvoicesFromDb();
  }, [period]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/ksef/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(settings)
      });
      if (res.status === 401) {
        setErrorMessage("Sesja wygasła (zrestartowano serwer). Wyloguj się i zaloguj ponownie do aplikacji.");
        return;
      }
      if (res.ok) {
        setSuccessMessage("Ustawienia KSeF zostały zapisane.");
        if (settings.token) {
          setHasToken(true);
          setSettings(prev => ({ ...prev, token: "" }));
        }
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Wystąpił błąd podczas zapisywania ustawień.");
      }
    } catch (err) {
      setErrorMessage("Nie udało się zapisać ustawień. Sprawdź połączenie.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSyncKsef = async () => {
    setSyncing(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/ksef/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(period)
      });
      const data = await res.json();
      if (res.ok) {
        setInvoices(data.invoices || []);
        if (data.last_sync_at) setLastSyncAt(data.last_sync_at);
        const count = data.invoices ? data.invoices.length : 0;
        if (data.warning) {
          setErrorMessage(data.warning);
        } else {
          setSuccessMessage(`Zsynchronizowano z KSeF (${count} faktur w bazie).`);
        }
      } else {
        setErrorMessage(data.error || "Błąd podczas synchronizacji z KSeF.");
      }
    } catch (err) {
      setErrorMessage("Błąd połączenia z serwerem podczas synchronizacji KSeF.");
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenImport = (invoice) => {
    setSelectedInvoice(invoice);
    const suggestedCat = invoice.suggested_category || "Inne";
    const suggestedCarCost = invoice.is_car_cost !== undefined ? invoice.is_car_cost : (suggestedCat === "Auto");
    setImportParams({ category: suggestedCat, isCarCost: suggestedCarCost });
    setShowImportModal(true);
  };

  const handleImportInvoice = async () => {
    if (!selectedInvoice) return;
    setImporting(true);
    setErrorMessage("");
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/ksef/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify({
          ksef_reference_number: selectedInvoice.ksef_reference_number,
          category: importParams.category,
          is_car_cost: importParams.isCarCost
        })
      });
      if (res.ok) {
        setInvoices(prev => prev.map(inv => {
          if (inv.ksef_reference_number === selectedInvoice.ksef_reference_number) {
            return { ...inv, is_imported: true };
          }
          return inv;
        }));
        setShowImportModal(false);
        setSuccessMessage(`Faktura ${selectedInvoice.invoice_number} została pomyślnie zaimportowana.`);
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Błąd podczas importu faktury.");
      }
    } catch (err) {
      setErrorMessage("Błąd połączenia. Nie można zaimportować kosztu.");
    } finally {
      setImporting(false);
    }
  };

  const handleIssueInvoice = async (e) => {
    e.preventDefault();
    setIssuing(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/ksef/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(issueParams)
      });
      const data = await res.json();
      if (res.ok) {
        setShowIssueModal(false);
        setSuccessMessage(data.message || "Faktura została pomyślnie wystawiona!");
        loadInvoicesFromDb();
      } else {
        setErrorMessage(data.error || "Błąd podczas wystawiania faktury.");
      }
    } catch (err) {
      setErrorMessage("Błąd połączenia z serwerem.");
    } finally {
      setIssuing(false);
    }
  };

  const addItemToIssue = () => {
    setIssueParams(prev => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, unit_price: 0, vat_rate: 23 }]
    }));
  };

  const removeItemFromIssue = (index) => {
    setIssueParams(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItemInIssue = (index, field, value) => {
    setIssueParams(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return "Brak (nie przeprowadzono synchronizacji)";
    const date = new Date(timestamp);
    return date.toLocaleString('pl-PL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const envLabel = (env) => {
    if (env === 'production') return 'Środowisko Produkcyjne';
    if (env === 'sandbox') return 'Środowisko Testowe (Sandbox)';
    return 'Tryb Mock (Lokalny)';
  };

  return (
    <div className="ksef-integration-wrapper" style={{ animation: "fadeIn 0.25s ease-out", paddingTop: "8px" }}>
      {/* Alert banners */}
      {errorMessage && (
        <div className={`ksef-alert ${errorMessage.includes("429") || errorMessage.includes("limit") || errorMessage.includes("odczekania") ? "warning" : "error"}`}>
          <span style={{ fontSize: "1.1rem" }}>{errorMessage.includes("429") || errorMessage.includes("limit") ? "⏱️" : "⚠️"}</span>
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="ksef-alert success">
          <span style={{ fontSize: "1.1rem" }}>✅</span>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Top Action & Control Bar */}
      <div className="settings-card" style={{ marginBottom: "24px", padding: "16px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
          
          {/* Controls: Month, Year, Sync Button */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)" }}>Okres:</label>
              <select
                value={period.month}
                onChange={e => setPeriod({ ...period, month: parseInt(e.target.value) })}
                className="settings-input"
                style={{ width: "auto", padding: "6px 10px", fontSize: "0.85rem" }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('pl-PL', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={period.year}
                onChange={e => setPeriod({ ...period, year: parseInt(e.target.value) })}
                className="settings-input"
                style={{ width: "auto", padding: "6px 10px", fontSize: "0.85rem" }}
              >
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <button
              onClick={handleSyncKsef}
              className="btn-primary"
              style={{ padding: "8px 18px", fontSize: "0.85rem", borderRadius: "6px" }}
              disabled={syncing}
            >
              {syncing ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <span className="spinner" style={{ width: "13px", height: "13px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></span>
                  Synchronizacja...
                </span>
              ) : "Synchronizuj z KSeF"}
            </button>

            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginLeft: "8px", borderLeft: "1px solid var(--border-color)", paddingLeft: "12px" }}>
              Ostatnia synch.: <strong style={{ color: lastSyncAt ? "var(--primary-color)" : "var(--text-muted)" }}>{formatLastSync(lastSyncAt)}</strong>
              <span className="badge" style={{ marginLeft: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)", fontSize: "0.72rem" }}>
                {envLabel(settings.environment)}
              </span>
            </div>
          </div>

          {/* Right side: Issue Invoice & Settings buttons */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setShowIssueModal(true)}
              className="btn-primary"
              style={{
                padding: "8px 16px",
                fontSize: "0.85rem",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#10b981",
                border: "none",
                color: "#ffffff",
                fontWeight: 600
              }}
            >
              + Wystaw Fakturę KSeF
            </button>

            <button
              onClick={() => setShowSettingsModal(true)}
              className="btn-secondary"
              style={{
                padding: "8px 14px",
                fontSize: "0.82rem",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                border: "1px solid var(--border-color)",
                background: "var(--bg-gray)",
                cursor: "pointer"
              }}
            >
              ⚙️ Ustawienia połączenia
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "480px" }}>
            <button className="close-btn" onClick={() => setShowSettingsModal(false)}>✕</button>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: 700 }}>⚙️ Konfiguracja Połączenia z KSeF 2.0</h3>
            
            {loadingSettings ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Ładowanie konfiguracji...</p>
            ) : (
              <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="settings-form-group">
                  <label>Środowisko KSeF</label>
                  <select
                    value={settings.environment}
                    onChange={e => setSettings({ ...settings, environment: e.target.value })}
                    className="settings-input"
                  >
                    <option value="mock">Tryb testowy (Mock - darmowy, lokalny)</option>
                    <option value="sandbox">Środowisko Testowe (api-test.ksef.mf.gov.pl/api/v2)</option>
                    <option value="production">Środowisko Produkcyjne (api.ksef.mf.gov.pl/api/v2)</option>
                  </select>
                </div>

                <div className="settings-form-group">
                  <label>NIP Przedsiębiorstwa</label>
                  <input
                    type="text"
                    value={settings.nip || ""}
                    onChange={e => setSettings({ ...settings, nip: e.target.value })}
                    placeholder="np. 7740001454"
                    className="settings-input"
                    required
                  />
                </div>

                <div className="settings-form-group">
                  <label>Token autoryzacyjny KSeF</label>
                  <input
                    type="password"
                    value={settings.token || ""}
                    onChange={e => setSettings({ ...settings, token: e.target.value })}
                    placeholder={hasToken ? "••••••••••••••••••••••••••••" : "Wklej token KSeF"}
                    className="settings-input"
                  />
                  {hasToken && (
                    <span style={{ fontSize: "0.75rem", color: "#10b981", fontWeight: 500, marginTop: "4px" }}>
                      ✓ Token autoryzacyjny jest zaszyfrowany (AES-256-GCM) w bazie danych
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                  <button type="button" onClick={() => setShowSettingsModal(false)} className="btn-secondary" style={{ padding: "8px 16px", borderRadius: "6px" }}>
                    Anuluj
                  </button>
                  <button type="submit" className="btn-primary" style={{ padding: "8px 18px", borderRadius: "6px" }} disabled={savingSettings}>
                    {savingSettings ? "Zapisywanie..." : "Zapisz ustawienia"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Invoices List Table */}
      <div className="table-wrapper">
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
            Lista faktur KSeF ({invoices.length})
          </h3>
          {loadingInvoices && (
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Ładowanie z bazy...</span>
          )}
        </div>
        <table className="users-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: "12%" }}>Typ</th>
              <th style={{ width: "20%" }}>Numer Faktury</th>
              <th style={{ width: "24%" }}>Kontrahent / NIP</th>
              <th style={{ width: "14%" }}>Kategoria</th>
              <th style={{ width: "11%" }}>Data</th>
              <th className="text-right" style={{ width: "12%" }}>Kwota (Brutto)</th>
              <th style={{ width: "7%", textAlign: "right", whiteSpace: "nowrap", paddingRight: "20px" }}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length > 0 ? (
              invoices.map(inv => {
                const rowId = inv.ksef_reference_number || inv.id;
                const isExpanded = !!expandedKsefRows[rowId];
                return (
                  <tr 
                    key={rowId}
                    className={`ksef-row-card ${isExpanded ? "row-expanded" : ""}`}
                    onClick={(evt) => {
                      if (evt.target.closest('button')) return;
                      setExpandedKsefRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
                    }}
                  >
                    <td className="cell-ksef-type">
                      <span 
                        className="badge" 
                        style={{ 
                          background: inv.is_sales ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                          color: inv.is_sales ? "#10b981" : "#f59e0b",
                          border: `1px solid ${inv.is_sales ? "#a7f3d0" : "#fde68a"}`,
                          fontSize: "0.72rem",
                          fontWeight: 700
                        }}
                      >
                        {inv.is_sales ? "Sprzedaż" : "Zakup"}
                      </span>
                    </td>
                    <td className="cell-ksef-number" style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                    <td className="cell-ksef-contractor">
                      <div style={{ fontWeight: 600 }}>{inv.contractor_name}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.76rem", marginTop: "2px" }}>NIP: {inv.contractor_nip}</div>
                    </td>
                    <td className="cell-ksef-category">
                      <span className="badge" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)", fontSize: "0.75rem" }}>
                        {inv.suggested_category || (inv.is_sales ? "Sprzedaż" : "Inne")}
                      </span>
                    </td>
                    <td className="cell-ksef-date" style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="text-right cell-ksef-brutto">
                      <div style={{ fontWeight: 600, color: inv.is_sales ? "#10b981" : "var(--text-main)" }}>
                        {inv.is_sales ? "+" : ""}{Number(inv.gross_amount).toFixed(2)} zł
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 400 }}>netto: {Number(inv.net_amount).toFixed(2)} zł</div>
                    </td>
                    <td className="cell-ksef-actions" style={{ textAlign: "right", whiteSpace: "nowrap", paddingRight: "20px" }}>
                      {inv.is_imported ? (
                        <span style={{ color: "#10b981", fontSize: "0.78rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          {inv.is_sales ? "W Przychody" : "W Kosztach"}
                        </span>
                      ) : (
                        <button onClick={() => handleOpenImport(inv)} className="btn-table btn-primary" style={{ padding: "5px 11px", fontSize: "0.75rem", borderRadius: "6px", whiteSpace: "nowrap" }}>
                          {inv.is_sales ? "+ Zaczytaj Przychód" : "+ Zaczytaj Koszt"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                  {loadingInvoices ? "Ładowanie faktur..." : "Brak faktur dla wybranego okresu w bazie. Kliknij 'Synchronizuj z KSeF', aby pobrać faktury."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Import Modal */}
      {showImportModal && selectedInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <button className="close-btn" onClick={() => setShowImportModal(false)}>✕</button>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", fontWeight: 700 }}>
              {selectedInvoice.is_sales ? "Zaczytywanie przychodu z KSeF" : "Zaczytywanie kosztu z KSeF"}
            </h3>
            
            <div style={{ background: "var(--bg-gray)", padding: "12px 16px", borderRadius: "6px", marginBottom: "20px", fontSize: "0.85rem" }}>
              <strong>Faktura:</strong> {selectedInvoice.invoice_number}<br/>
              <strong>Kontrahent:</strong> {selectedInvoice.contractor_name} (NIP: {selectedInvoice.contractor_nip})<br/>
              <strong>Brutto:</strong> {Number(selectedInvoice.gross_amount).toFixed(2)} zł (netto: {Number(selectedInvoice.net_amount).toFixed(2)} zł)
            </div>

            <div className="form-group" style={{ marginBottom: "15px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px", display: "block" }}>Kategoria</label>
              <select
                value={importParams.category}
                onChange={e => setImportParams({ ...importParams, category: e.target.value })}
                className="settings-input"
              >
                {selectedInvoice.is_sales ? (
                  <>
                    <option value="Sprzedaż">Sprzedaż usług / towarów</option>
                    <option value="Inne przychody">Inne przychody</option>
                  </>
                ) : (
                  <>
                    <option value="Auto">Auto (Paliwo, Serwis, Części)</option>
                    <option value="Media">Media (Prąd, Gaz, Woda)</option>
                    <option value="Telefon/Internet">Telefon / Internet / Abonamenty</option>
                    <option value="Oprogramowanie/IT">Oprogramowanie / Usługi IT</option>
                    <option value="Materiały i Wyposażenie">Materiały i Wyposażenie</option>
                    <option value="Usługi Obce">Usługi Obce / Podwykonawcy</option>
                    <option value="Inne">Inne</option>
                  </>
                )}
              </select>
            </div>

            {!selectedInvoice.is_sales && (
              <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: "10px", marginTop: "12px", marginBottom: "15px" }}>
                <input
                  type="checkbox"
                  id="isCarCostCheck"
                  checked={importParams.isCarCost}
                  onChange={e => setImportParams({ ...importParams, isCarCost: e.target.checked })}
                />
                <label htmlFor="isCarCostCheck" style={{ textTransform: "none", letterSpacing: "normal", fontWeight: 500, fontSize: "0.85rem", cursor: "pointer" }}>
                  Koszty eksploatacji pojazdu (Auto - odliczenie 50% VAT / 75% KPiR)
                </label>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button onClick={() => setShowImportModal(false)} className="btn-secondary" disabled={importing}>
                Anuluj
              </button>
              <button onClick={handleImportInvoice} className="btn-primary" disabled={importing}>
                {importing ? "Importowanie..." : "Potwierdź import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Invoice Modal */}
      {showIssueModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "600px" }}>
            <button className="close-btn" onClick={() => setShowIssueModal(false)}>✕</button>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.2rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
              🧾 Wystawianie Faktury Sprzedaży
            </h3>

            <form onSubmit={handleIssueInvoice} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="settings-form-group">
                  <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Nazwa Nabywcy / Klienta</label>
                  <input
                    type="text"
                    value={issueParams.contractor_name}
                    onChange={e => setIssueParams({ ...issueParams, contractor_name: e.target.value })}
                    placeholder="np. Jan Kowalski / Firma Sp. z o.o."
                    className="settings-input"
                    required
                  />
                </div>
                <div className="settings-form-group">
                  <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>NIP Nabywcy</label>
                  <input
                    type="text"
                    value={issueParams.contractor_nip}
                    onChange={e => setIssueParams({ ...issueParams, contractor_nip: e.target.value })}
                    placeholder="np. 5213000000"
                    className="settings-input"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="settings-form-group">
                  <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Numer Faktury</label>
                  <input
                    type="text"
                    value={issueParams.invoice_number}
                    onChange={e => setIssueParams({ ...issueParams, invoice_number: e.target.value })}
                    placeholder="Auto (np. FV/2026/08/101)"
                    className="settings-input"
                  />
                </div>
                <div className="settings-form-group">
                  <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Data Wystawienia</label>
                  <input
                    type="date"
                    value={issueParams.date}
                    onChange={e => setIssueParams({ ...issueParams, date: e.target.value })}
                    className="settings-input"
                    required
                  />
                </div>
              </div>

              <div style={{ marginTop: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600 }}>Pozycje na Fakturze</label>
                  <button type="button" onClick={addItemToIssue} className="btn-secondary" style={{ padding: "4px 10px", fontSize: "0.75rem" }}>
                    + Dodaj pozycję
                  </button>
                </div>

                {issueParams.items.map((item, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 40px", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="Nazwa usługi/towaru"
                      value={item.description}
                      onChange={e => updateItemInIssue(idx, "description", e.target.value)}
                      className="settings-input"
                      style={{ fontSize: "0.82rem" }}
                      required
                    />
                    <input
                      type="number"
                      placeholder="Ilość"
                      value={item.quantity}
                      onChange={e => updateItemInIssue(idx, "quantity", parseFloat(e.target.value) || 1)}
                      className="settings-input"
                      style={{ fontSize: "0.82rem" }}
                      required
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Cena netto zł"
                      value={item.unit_price}
                      onChange={e => updateItemInIssue(idx, "unit_price", parseFloat(e.target.value) || 0)}
                      className="settings-input"
                      style={{ fontSize: "0.82rem" }}
                      required
                    />
                    {issueParams.items.length > 1 && (
                      <button type="button" onClick={() => removeItemFromIssue(idx)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "1.1rem" }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ background: "var(--bg-gray)", padding: "12px 16px", borderRadius: "8px", marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    id="sendKsefCheck"
                    checked={issueParams.send_to_ksef}
                    onChange={e => setIssueParams({ ...issueParams, send_to_ksef: e.target.checked })}
                  />
                  <label htmlFor="sendKsefCheck" style={{ fontSize: "0.83rem", fontWeight: 600, cursor: "pointer", textTransform: "none" }}>
                    Wyślij fakturę bezpośrednio do KSeF
                  </label>
                </div>
                <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>
                  Razem brutto: {(issueParams.items.reduce((sum, it) => sum + (it.quantity * it.unit_price * 1.23), 0)).toFixed(2)} zł
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowIssueModal(false)} className="btn-secondary" disabled={issuing}>
                  Anuluj
                </button>
                <button type="submit" className="btn-primary" style={{ background: "#10b981" }} disabled={issuing}>
                  {issuing ? "Wystawianie..." : "Wystaw i Zarejestruj Fakturę"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Embedded CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
