import { useEffect, useState } from "react";

export default function TaxDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [showSplit, setShowSplit] = useState(false);
  const [splitPercent, setSplitPercent] = useState(70);
  const [carriedVatInput, setCarriedVatInput] = useState(0);

  useEffect(() => {
    if (stats?.taxes?.carriedVat !== undefined) {
      setCarriedVatInput(stats.taxes.carriedVat);
    }
  }, [stats]);

  const saveCarriedVat = async () => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/settings`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${authData?.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          year: period.year,
          month: period.month,
          carried_vat: carriedVatInput
        })
      });
      fetchStats();
    } catch (e) {
      console.error(e);
    }
  };

  const totalTaxes = (stats?.taxes?.vat || 0) + (stats?.taxes?.pit || 0) + (stats?.taxes?.health || 0);
  const netProfit = (stats?.revenue?.net || 0) - (stats?.expenses?.net || 0) - totalTaxes;


  const fetchStats = async () => {
    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/stats?year=${period.year}&month=${period.month}`, {
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setStats(data);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [period]);

  if (loading && !stats) return <p>Ładowanie statystyk...</p>;

  return (
    <div className="tax-dashboard">
      <div className="period-selector">
        <select 
          value={period.month} 
          onChange={e => setPeriod({...period, month: parseInt(e.target.value)})}
          className="form-select"
        >
          {Array.from({length: 12}, (_, i) => (
            <option key={i+1} value={i+1}>
              {new Date(0, i).toLocaleString('pl-PL', {month: 'long'})}
            </option>
          ))}
        </select>
        <select 
          value={period.year} 
          onChange={e => setPeriod({...period, year: parseInt(e.target.value)})}
          className="form-select"
        >
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: '20px', background: 'var(--bg-card)', padding: '14px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <label style={{ fontSize: '0.88rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>VAT przeniesiony z zeszłego miesiąca:</label>
        <input 
          type="number" 
          value={carriedVatInput} 
          onChange={e => setCarriedVatInput(e.target.value)} 
          className="form-input"
          style={{ width: '120px', padding: '6px 12px' }}
        />
        <button onClick={saveCarriedVat} className="btn-primary" style={{ padding: '6px 15px', borderRadius: '4px', cursor: 'pointer' }}>Zapisz</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <label>Przychód</label>
          <div className="stat-value text-primary">{stats?.revenue?.net || 0} zł <span style={{fontSize: '0.6em', color: 'var(--text-muted)'}}>netto</span></div>
          <div className="stat-value text-primary" style={{fontSize: '1.2rem', marginTop: '4px'}}>{stats?.revenue?.gross || 0} zł <span style={{fontSize: '0.6em', color: 'var(--text-muted)'}}>brutto</span></div>
          <div className="stat-sub" style={{marginTop: '4px'}}>VAT: +{stats?.revenue?.vat || 0} zł</div>
        </div>
        <div className="stat-card">
          <label>Koszty (KPiR)</label>
          <div className="stat-value text-danger">{stats?.expenses?.kpir || 0} zł</div>
          <div className="stat-sub">
            Wydatki netto: {stats?.expenses?.net || 0} zł<br/>
            Wydatki brutto: {stats?.expenses?.gross || 0} zł
          </div>
        </div>
        <div className="stat-card">
          <label>Dochód</label>
          <div className="stat-value">{stats?.taxes?.income || 0} zł</div>
          <div className="stat-sub">Przychód - Koszty (75% / 100%)</div>
        </div>
      </div>

      <h3 className="section-title">Prognozowane Podatki / Składki</h3>
      <div className="taxes-grid">
        <div className="tax-item card-vat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--primary-color)' }}>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
          <div className="tax-info">
            <span className="tax-label">VAT do zapłaty</span>
            <span className="tax-amount">{stats?.taxes?.vat || 0} zł</span>
            {stats?.taxes?.nextMonthCarriedVat > 0 && (
               <span style={{fontSize: '0.75rem', color: '#16a34a', marginTop: '4px', display: 'block'}}>
                 VAT do przeniesienia na kolejny miesiąc: <strong>{stats.taxes.nextMonthCarriedVat} zł</strong>
               </span>
            )}
          </div>
        </div>
        <div className="tax-item card-pit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#10b981' }}>
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <div className="tax-info">
            <span className="tax-label">PIT (Skala z Kwotą Wolną 30k zł)</span>
            <span className="tax-amount">{stats?.taxes?.pit || 0} zł</span>
            <span style={{fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block'}}>
              Zwolnienie 2 500 zł/mies., próg 32% powyżej 10 000 zł/mies.
            </span>
          </div>
        </div>

        <div className="tax-item card-zus">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: '#ef4444' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7s0 6 8 10z"/>
          </svg>
          <div className="tax-info">
            <span className="tax-label">Składka Zdrowotna (9%)</span>
            <span className="tax-amount">{stats?.taxes?.health || 0} zł</span>
          </div>
        </div>
      </div>

      <div className="tax-summary-alert">
          <span>Łącznie do zapłaty (VAT + PIT + ZUS):</span>
          <strong> {Math.round(((stats?.taxes?.vat || 0) + (stats?.taxes?.pit || 0) + (stats?.taxes?.health || 0)) * 100) / 100} zł</strong>
      </div>

      <div style={{ marginTop: '30px' }}>
        <button 
          onClick={() => setShowSplit(!showSplit)} 
          className="btn-secondary-outline"
          style={{ marginBottom: '15px' }}
        >
          {showSplit ? "Ukryj planowanie wypłaty" : "Pokaż planowanie wypłaty"}
        </button>

        {showSplit && (
          <div className="profit-split-card" style={{ 
            background: 'var(--bg-gray)', 
            padding: '20px', 
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            animation: 'fadeIn 0.25s ease'
          }}>
            <h4 style={{ marginBottom: '16px', fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>Planowanie Portfela (Po odliczeniu danin)</h4>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500, fontSize: '0.85rem' }}>
                Podział: {splitPercent}% Prywatnie / {100-splitPercent}% Na obrót
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={splitPercent} 
                onChange={(e) => setSplitPercent(parseInt(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary-color)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Portfel Prywatny</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#16a34a', marginTop: '4px' }}>
                  {Math.round(netProfit * (splitPercent/100) * 100) / 100} zł
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '15px', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Fundusz Firmowy</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--primary-color)', marginTop: '4px' }}>
                  {Math.round(netProfit * ((100-splitPercent)/100) * 100) / 100} zł
                </div>
              </div>
            </div>
            <div style={{ marginTop: '15px', fontSize: '0.8rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              * Wyliczone z czystego zysku: <strong>{Math.round(netProfit * 100) / 100} zł</strong>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
