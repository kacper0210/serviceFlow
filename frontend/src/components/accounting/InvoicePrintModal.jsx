import React from 'react';
import './invoicePrint.css';

export default function InvoicePrintModal({ invoice, onClose }) {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  // Helper formatting numbers: 150 -> 150,00
  const formatMoney = (val) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper formatting date YYYY-MM-DD
  const formatDate = (dStr) => {
    if (!dStr) return '';
    try {
      return new Date(dStr).toISOString().split('T')[0];
    } catch {
      return dStr;
    }
  };

  return (
    <div className="invoice-modal-overlay">
      <div className="invoice-modal-actions">
        <button className="inv-btn-print" onClick={handlePrint}>
          🖨️ Drukuj / Pobierz PDF
        </button>
        <button className="inv-btn-close" onClick={onClose}>
          ✕ Zamknij
        </button>
      </div>

      <div className="invoice-template">
        {/* Header Top */}
        <div className="inv-header-top">
          <div className="inv-brand">
            <img
              src="/kmtechfix-logo.png"
              alt="KMTechFix Logo"
              style={{ maxHeight: '65px', maxWidth: '240px', objectFit: 'contain' }}
            />
          </div>

          <div className="inv-dates-container">
            <div className="inv-date-item">
              <span className="inv-date-lbl">Data wystawienia:</span>
              <span className="inv-date-val">{formatDate(invoice.issue_date)}</span>
            </div>
            <div className="inv-date-item">
              <span className="inv-date-lbl">Data wydania towaru lub wykonania usługi:</span>
              <span className="inv-date-val">{formatDate(invoice.sale_date)}</span>
            </div>
          </div>
        </div>

        {/* Invoice Title & Number */}
        <div className="inv-title-box">
          <h2 className="inv-title-text">
            {invoice.document_type === 'faktura_zaliczkowa' && `Faktura Zaliczkowa nr ${invoice.invoice_number}`}
            {invoice.document_type === 'faktura_koncowa' && `Faktura Końcowa nr ${invoice.invoice_number}`}
            {invoice.document_type === 'faktura_proforma' && `Faktura Proforma nr ${invoice.invoice_number}`}
            {(!invoice.document_type || invoice.document_type === 'faktura_vat') && `Faktura nr ${invoice.invoice_number}`}
          </h2>
        </div>

        {/* Parties Grid */}
        <div className="inv-parties-grid">
          <div className="inv-party-column">
            <h3>Wystawca</h3>
            <div className="inv-party-company">{invoice.seller_name || 'KMTechFix Kacper Wójcik'}</div>
            <div className="inv-party-address">
              {invoice.seller_address ? (
                invoice.seller_address.split(',').map((line, idx) => (
                  <div key={idx}>{line.trim()}</div>
                ))
              ) : (
                <>
                  <div>ul. Koszalińska 12 / 1</div>
                  <div>78-230 Karlino</div>
                </>
              )}
            </div>
            <div className="inv-party-nip">NIP: {invoice.seller_nip || '6722109643'}</div>
          </div>

          <div className="inv-party-column">
            <h3>Nabywca</h3>
            <div className="inv-party-company">{invoice.buyer_name}</div>
            {invoice.buyer_address && (
              <div className="inv-party-address" style={{ whiteSpace: 'pre-line' }}>
                {invoice.buyer_address}
              </div>
            )}
            {invoice.buyer_nip && (
              <div className="inv-party-nip">NIP: {invoice.buyer_nip}</div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <table className="inv-items-table">
          <thead>
            <tr>
              <th className="col-lp">Lp.</th>
              <th className="col-pos">Pozycja</th>
              <th className="col-num">Cena netto</th>
              <th className="col-num">Ilość</th>
              <th className="col-unit">Jedn.</th>
              <th className="col-num">Wartość netto</th>
              <th className="col-vat">VAT%</th>
              <th className="col-num">Kwota VAT</th>
              <th className="col-num">Wartość brutto</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, idx) => (
              <tr key={idx}>
                <td className="col-lp">{item.lp || idx + 1}.</td>
                <td className="col-pos">{item.name}</td>
                <td className="col-num">{formatMoney(item.unit_price_net)}</td>
                <td className="col-num">{parseFloat(item.quantity)}</td>
                <td className="col-unit">{item.unit || 'szt.'}</td>
                <td className="col-num">{formatMoney(item.net_amount)}</td>
                <td className="col-vat">{item.vat_rate}</td>
                <td className="col-num">{formatMoney(item.vat_amount)}</td>
                <td className="col-num">{formatMoney(item.gross_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals & VAT Breakdown Section */}
        <div className="inv-totals-wrapper">
          <table className="inv-totals-table">
            <tbody>
              <tr className="row-razem">
                <td className="vat-label" style={{ textAlign: 'right' }}>Razem</td>
                <td style={{ width: '80px' }}>{formatMoney(invoice.total_net)}</td>
                <td style={{ width: '40px' }}>---</td>
                <td style={{ width: '70px' }}>{formatMoney(invoice.total_vat)}</td>
                <td style={{ width: '80px' }}>{formatMoney(invoice.total_gross)}</td>
              </tr>

              {(invoice.vatBreakdown || []).map((vRow, vIdx) => (
                <tr key={vIdx}>
                  <td className="vat-label">Rozliczenie VAT (PLN)</td>
                  <td>{formatMoney(vRow.net)}</td>
                  <td>{vRow.vatRate}</td>
                  <td>{formatMoney(vRow.vat)}</td>
                  <td>{formatMoney(vRow.gross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Payment Summary */}
        <div className="inv-bottom-grid">
          <div className="inv-payment-container">
            <div className="inv-due-header">
              <span className="inv-due-title">Do zapłaty</span>
              <span className="inv-due-amount">{formatMoney(invoice.total_gross)} PLN</span>
            </div>

            <div className="inv-pay-row">
              <span className="inv-pay-key">Słownie</span>
              <span className="inv-pay-val slownie-val">{invoice.kwota_slownie}</span>
            </div>

            <div className="inv-pay-row">
              <span className="inv-pay-key">Sposób zapłaty</span>
              <span className="inv-pay-val">{invoice.payment_method || 'przelew'}</span>
            </div>

            <div className="inv-pay-row">
              <span className="inv-pay-key">Termin</span>
              <span className="inv-pay-val">{formatDate(invoice.payment_deadline)}</span>
            </div>

            <div className="inv-pay-row">
              <span className="inv-pay-key">Rachunek</span>
              <span className="inv-pay-val inv-bank-number">{invoice.bank_account || '83 1140 2004 0000 3302 8526 9999'}</span>
            </div>

            {invoice.split_payment && (
              <div className="inv-pay-row" style={{ marginTop: '6px' }}>
                <span className="inv-pay-key" style={{ color: '#00703C', fontWeight: 700 }}>Adnotacja</span>
                <span className="inv-pay-val" style={{ color: '#00703C', fontWeight: 700 }}>Mechanizm podzielonej płatności</span>
              </div>
            )}
          </div>
        </div>

        {/* Remarks / Uwagi Section */}
        {invoice.notes && (
          <div className="inv-notes-box">
            <div className="inv-notes-title">Uwagi:</div>
            <div className="inv-notes-content">{invoice.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div className="inv-page-footer">
          <hr className="inv-footer-hr" />
          <div className="inv-footer-row">
            <div>
              Faktura wygenerowana przez system ServiceFlow.
            </div>
            <div style={{ fontWeight: 700 }}>1/1</div>
          </div>
        </div>
      </div>
    </div>
  );
}
