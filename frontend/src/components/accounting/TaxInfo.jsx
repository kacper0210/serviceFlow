import React from "react";

export default function TaxInfo() {
  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 6px 0", color: "var(--text-main)" }}>
          📋 Profil i Zasady Podatkowe
        </h2>
        <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", margin: 0 }}>
          Aktualnie stosowane parametry, limity oraz reguły automatycznych wyliczeń w aplikacji.
        </p>
      </div>

      {/* Main Status Banner */}
      <div 
        style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)",
          border: "1px solid rgba(37, 99, 235, 0.2)",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "flex-start",
          gap: "16px"
        }}
      >
        <div style={{ fontSize: "2rem", lineHeight: 1 }}>🎓</div>
        <div>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)" }}>
            Profil Podatkowy: Student &lt;26 lat (PIT-0 dla Młodych)
          </h3>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Dzięki zwolnieniu z podatku dochodowego z tytułu umowy o pracę (PIT-0 do 85 528 zł rocznie), Twój etat nie zużywa kwoty wolnej ani pierwszego progu podatkowego. Twoja Działalność Gospodarcza dysponuje <strong>pełnymi pełnymi limitami podatkowymi</strong> na Skali Podatkowej.
          </p>
        </div>
      </div>

      {/* Grid of Rules Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px", marginBottom: "24px" }}>
        
        {/* Card 1: Kwota Wolna i Progi */}
        <div className="stat-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <span style={{ fontSize: "1.2rem" }}>💰</span>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>Kwota Wolna i Progi PIT</h4>
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
            <li><strong>Kwota wolna od podatku:</strong> 30 000 zł rocznie (2 500 zł / mies.) dla JDG.</li>
            <li><strong>I próg podatkowy (12%):</strong> Dochód od 2 500 zł do 10 000 zł / mies.</li>
            <li><strong>II próg podatkowy (32%):</strong> Dochód powyżej 10 000 zł / mies. (ponad 120 000 zł rocznie).</li>
          </ul>
        </div>

        {/* Card 2: ZUS i Składka Zdrowotna */}
        <div className="stat-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <span style={{ fontSize: "1.2rem" }}>🏥</span>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>ZUS i Składka Zdrowotna</h4>
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
            <li><strong>Zbieg tytułów:</strong> Etat &gt; płaca minimalna zwalnia z podwójnych składek społecznych.</li>
            <li><strong>Składka Zdrowotna (Skala):</strong> 9% od dochodu KPiR.</li>
            <li><strong>Minimum zdrowotne:</strong> 432,54 zł / miesiąc.</li>
          </ul>
        </div>

        {/* Card 3: Koszty Samochodu */}
        <div className="stat-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <span style={{ fontSize: "1.2rem" }}>🚗</span>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>Rozliczanie Pojazdu</h4>
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
            <li><strong>Tryb użytkowania:</strong> Mieszany (prywatno-firmowy).</li>
            <li><strong>Odliczenie VAT:</strong> 50% naliczonego VAT od paliwa i serwisu.</li>
            <li><strong>Koszt KPiR:</strong> 75% kwoty (Netto + 50% nieodliczonego VAT).</li>
          </ul>
        </div>

      </div>

      {/* Explanatory Box */}
      <div 
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "10px",
          padding: "16px 20px",
          fontSize: "0.83rem",
          color: "var(--text-muted)",
          lineHeight: 1.6
        }}
      >
        <strong style={{ color: "var(--text-main)" }}>ℹ️ Wzór obliczeń zaliczki PIT używany w systemie:</strong>
        <br />
        • Dla dochodu do 2 500 zł / mies.: <code>PIT = 0 zł</code>
        <br />
        • Dla dochodu od 2 500 zł do 10 000 zł / mies.: <code>PIT = (Dochód - 2500 zł) × 12%</code>
        <br />
        • Dla dochodu powyżej 10 000 zł / mies.: <code>PIT = (7500 zł × 12%) + ((Dochód - 10000 zł) × 32%)</code>
      </div>
    </div>
  );
}
