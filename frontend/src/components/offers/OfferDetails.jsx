import { useState, useEffect } from "react";

export default function OfferDetails({ offerId, onClose, onConverted }) {
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchOfferDetails = async () => {
    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/offers/${offerId}`, {
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOffer(data);
      } else {
        alert("Błąd podczas pobierania szczegółów oferty.");
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem.");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfferDetails();
  }, [offerId]);

  const handlePrint = () => {
    window.print();
  };

  const handleConvert = async () => {
    if (!window.confirm("Czy chcesz automatycznie przekształcić tę ofertę w aktywne zlecenie? Status oferty zostanie zmieniony na 'zaakceptowana'.")) return;

    setStatusLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/offers/${offerId}/convert`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });

      if (res.ok) {
        alert("Pomyślnie przekonwertowano ofertę na zlecenie!");
        onConverted();
      } else {
        const err = await res.json();
        alert(`Błąd konwersji: ${err.error || "Nieznany błąd"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatusLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const payload = {
        ...offer,
        status: newStatus
      };
      
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/offers/${offerId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${authData?.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setOffer(updated);
      } else {
        alert("Nie udało się zaktualizować statusu.");
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem.");
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ textAlign: 'center', padding: '50px' }}>
          <h3>Ładowanie szczegółów oferty...</h3>
        </div>
      </div>
    );
  }

  const clientName = offer.company_name 
    ? offer.company_name 
    : `${offer.first_name || ""} ${offer.last_name || ""}`.trim();

  const formatDate = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatMoney = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '960px', padding: '24px', background: 'var(--bg-app)' }}>
        
        {/* Top actions toolbar (system UI, hidden on print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '800', color: 'var(--text-muted)' }}>Status:</span>
            <select
              className="form-select"
              value={offer.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={statusLoading}
              style={{ width: '160px', padding: '6px 12px', fontSize: '0.9rem', borderRadius: '8px' }}
            >
              <option value="robocza">Robocza</option>
              <option value="wyslana">Wysłana</option>
              <option value="zaakceptowana">Zaakceptowana</option>
              <option value="odrzucona">Odrzucona</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={handlePrint} style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
              🖨️ Drukuj / PDF
            </button>
            {offer.status !== "zaakceptowana" && (
              <button className="btn btn-primary" onClick={handleConvert} disabled={statusLoading} style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
                ⚙️ Konwertuj na Zlecenie
              </button>
            )}
            <button className="btn btn-secondary" onClick={onClose} style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
              Zamknij
            </button>
          </div>
        </div>

        {/* Clean document design (KMTechFix HTML Template) */}
        <div className="page">

          <div className="header">
            <div>
              <div className="brand-name">KM<span>Tech</span>Fix</div>
              <div className="brand-name" style={{ fontSize: '15px', fontWeight: 500, marginTop: '2px' }}>Kacper Wójcik</div>
              <div className="brand-meta">Tel. +48 737 174 535<br />NIP: 672-210-96-43 &nbsp;·&nbsp; REGON: 529822391</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="date">Karlino, {formatDate(offer.created_at)} r.</div>
              {clientName && (
                <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#4b5563', lineHeight: 1.4 }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: '#9ca3af', display: 'block', marginBottom: '2px' }}>Nabywca / Klient</span>
                  <strong style={{ fontSize: '13px', color: '#111827' }}>{clientName}</strong>
                  {offer.client_address && <div>{offer.client_address}</div>}
                  {offer.client_nip && <div>NIP: {offer.client_nip}</div>}
                  {offer.client_phone && <div>Tel: {offer.client_phone}</div>}
                </div>
              )}
            </div>
          </div>

          <div className="doc-title">
            <div className="doc-label">Oferta handlowo-kosztorysowa</div>
            <div className="doc-heading">{offer.title}</div>
            {offer.description && <div className="doc-sub">{offer.description}</div>}
          </div>

          <div className="section">
            <div className="section-title">Kalkulacja kosztów</div>
            <table className="cost-table">
              <thead>
                <tr>
                  <th className="col-name">Nazwa pozycji</th>
                  <th className="col-price">Cena netto</th>
                  <th className="col-vat">VAT %</th>
                  <th className="col-gross">Cena brutto</th>
                  <th className="col-qty">Ilość</th>
                  <th className="col-tot-net">Wartość netto</th>
                  <th className="col-tot-vat">Wartość VAT</th>
                  <th className="col-tot-gross">Wartość brutto</th>
                </tr>
              </thead>
              <tbody>
                {offer.items && offer.items.map((item) => {
                  const vatRate = item.vat_rate !== undefined ? parseFloat(item.vat_rate) : 23;
                  const unitPriceNet = parseFloat(item.unit_price_net) || 0;
                  const unitVat = unitPriceNet * (vatRate / 100);
                  const unitGross = unitPriceNet + unitVat;
                  const qty = parseFloat(item.quantity) || 1;
                  const net = parseFloat(item.net_amount) || (unitPriceNet * qty);
                  const vat = parseFloat(item.vat_amount) || (unitVat * qty);
                  const gross = parseFloat(item.gross_amount) || (net + vat);

                  return (
                    <tr key={item.id}>
                      <td className="col-name">
                        <strong>{item.title}</strong>
                        {item.description && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{item.description}</div>}
                      </td>
                      <td className="col-price">{formatMoney(unitPriceNet)}</td>
                      <td className="col-vat">{vatRate}%</td>
                      <td className="col-gross">{formatMoney(unitGross)}</td>
                      <td className="col-qty">{qty} {item.unit || "szt."}</td>
                      <td className="col-tot-net">{formatMoney(net)}</td>
                      <td className="col-tot-vat">{formatMoney(vat)}</td>
                      <td className="col-tot-gross">{formatMoney(gross)}</td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td className="col-name" colSpan="5"><strong>RAZEM</strong></td>
                  <td className="col-tot-net">{formatMoney(offer.total_net)}</td>
                  <td className="col-tot-vat">{formatMoney(offer.total_vat)}</td>
                  <td className="col-tot-gross">{formatMoney(offer.total_gross)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="section">
            <div className="section-title">Podsumowanie finansowe</div>
            <div className="summary">
              <div className="sum-item">
                <div className="sum-label">Wartość netto</div>
                <div className="sum-value">{formatMoney(offer.total_net)}</div>
              </div>
              <div className="sum-item">
                <div className="sum-label">Suma VAT</div>
                <div className="sum-value">{formatMoney(offer.total_vat)}</div>
              </div>
              <div className="sum-item pay">
                <div className="sum-label">Do zapłaty brutto</div>
                <div className="sum-value">{formatMoney(offer.total_gross)}</div>
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Specyfikacja urządzeń i warunki realizacji</div>
            <div className="tech-box">
              {offer.notes ? (
                <div style={{ whiteSpace: 'pre-wrap', marginBottom: '8px' }}>{offer.notes}</div>
              ) : (
                <div style={{ marginBottom: '8px' }}>Wszelkie materiały i urządzenia zostaną dostarczone oraz zamontowane zgodnie ze sztuką monterską.</div>
              )}
              
              <div className="conditions-grid">
                <div className="condition-item">
                  <strong>Gwarancja:</strong> 24 miesiące na urządzenia (od dnia dostawy), 12 miesięcy na prace montażowe.
                </div>
                <div className="condition-item">
                  <strong>Ważność oferty:</strong> {offer.valid_until ? formatDate(offer.valid_until) : "30 dni od daty wystawienia"}.
                </div>
              </div>
            </div>
          </div>

          <div className="signatures-section">
            <div className="signature-box vendor">
              <div className="signature-title">Sporządził</div>
              <div className="stamp-container">
                <img src="/pieczatka_podpis.png" alt="Pieczątka i podpis KMTechFix Kacper Wójcik" className="stamp-img" />
              </div>
            </div>
          </div>

          <div className="footer">
            <div className="validity-note">
              Oferta ważna do: {offer.valid_until ? formatDate(offer.valid_until) : "30 dni od daty wystawienia"}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
