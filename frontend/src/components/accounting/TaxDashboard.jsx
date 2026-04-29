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

      <div style={{ marginBottom: '20px', background: 'white', padding: '15px', borderRadius: '12px', display: 'flex', gap: '15px', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <label style={{ fontWeight: 'bold', margin: 0 }}>VAT przeniesiony z zeszłego miesiąca:</label>
        <input 
          type="number" 
          value={carriedVatInput} 
          onChange={e => setCarriedVatInput(e.target.value)} 
          className="form-input"
          style={{ width: '120px', padding: '5px 10px', borderRadius: '6px', border: '1px solid #ccc' }}
        />
        <button onClick={saveCarriedVat} className="btn-primary" style={{ padding: '6px 15px', borderRadius: '6px', cursor: 'pointer' }}>Zapisz</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <label>Przychód</label>
          <div className="stat-value text-primary">{stats?.revenue?.net || 0} zł <span style={{fontSize: '0.6em', color: '#666'}}>netto</span></div>
          <div className="stat-value text-primary" style={{fontSize: '1.2rem', marginTop: '5px'}}>{stats?.revenue?.gross || 0} zł <span style={{fontSize: '0.6em', color: '#666'}}>brutto</span></div>
          <div className="stat-sub" style={{marginTop: '8px'}}>VAT: +{stats?.revenue?.vat || 0} zł</div>
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
          <div className="tax-icon">🧾</div>
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
          <div className="tax-icon">📈</div>
          <div className="tax-info">
            <span className="tax-label">PIT (Skala 12%/32%)</span>
            <span className="tax-amount">{stats?.taxes?.pit || 0} zł</span>
          </div>
        </div>

        <div className="tax-item card-zus">
          <div className="tax-icon">🏥</div>
          <div className="tax-info">
            <span className="tax-label">Składka Zdrowotna (9%)</span>
            <span className="tax-amount">{stats?.taxes?.health || 0} zł</span>
          </div>
        </div>
      </div>

      <div className="tax-summary-alert">
          Łącznie do zapłaty (VAT + PIT + ZUS): 
          <strong> {Math.round(((stats?.taxes?.vat || 0) + (stats?.taxes?.pit || 0) + (stats?.taxes?.health || 0)) * 100) / 100} zł</strong>
      </div>

      <div style={{ marginTop: '30px' }}>
        <button 
          onClick={() => setShowSplit(!showSplit)} 
          className="btn-secondary-outline"
          style={{ marginBottom: '15px' }}
        >
          {showSplit ? "🙈 Schowaj podział zysku" : "💰 Pokaż planowanie wypłaty"}
        </button>

        {showSplit && (
          <div className="profit-split-card" style={{ 
            background: 'var(--bg-gray)', 
            padding: '25px', 
            borderRadius: '20px',
            border: '2px solid var(--border-color)',
            animation: 'fadeIn 0.3s ease'
          }}>
            <h4 style={{ marginBottom: '20px' }}>Planowanie Portfela (Po odliczeniu danin)</h4>
            
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ background: 'white', padding: '15px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Portfel Prywatny</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#16a34a' }}>
                  {Math.round(netProfit * (splitPercent/100) * 100) / 100} zł
                </div>
              </div>
              <div style={{ background: 'white', padding: '15px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase' }}>Fundusz Firmowy</div>
                <div style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary-color)' }}>
                  {Math.round(netProfit * ((100-splitPercent)/100) * 100) / 100} zł
                </div>
              </div>
            </div>
            <div style={{ marginTop: '15px', fontSize: '0.85rem', textAlign: 'center', opacity: 0.7 }}>
              * Wyliczone z czystego zysku: <strong>{Math.round(netProfit * 100) / 100} zł</strong>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
