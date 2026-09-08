import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import InvoiceForm from './InvoiceForm';
import InvoicePrintModal from './InvoicePrintModal';
import './accounting.css';

export default function InvoicesList() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [printingInvoice, setPrintingInvoice] = useState(null);

  const getAuthHeaders = () => {
    const authData = JSON.parse(localStorage.getItem("auth"));
    const token = authData?.token;
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    };
  };

  useEffect(() => {
    fetchInvoices();
  }, [search]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`${API_URL}/api/invoices${q}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setInvoices(data);
      }
    } catch (e) {
      console.error('Błąd pobierania faktur:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPrint = async (invId) => {
    try {
      const res = await fetch(`${API_URL}/api/invoices/${invId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const fullData = await res.json();
        setPrintingInvoice(fullData);
      }
    } catch (e) {
      console.error('Błąd pobierania szczegółów faktury:', e);
    }
  };

  const handleEdit = async (invId) => {
    try {
      const res = await fetch(`${API_URL}/api/invoices/${invId}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const fullData = await res.json();
        setEditingInvoice(fullData);
        setShowForm(true);
      }
    } catch (e) {
      console.error('Błąd pobierania szczegółów faktury:', e);
    }
  };

  const handleDelete = async (invId, invNo) => {
    if (!window.confirm(`Czy na pewno chcesz usunąć fakturę ${invNo}? Usunięcie faktury wycofa też wpis z księgowości.`)) return;

    try {
      const res = await fetch(`${API_URL}/api/invoices/${invId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        fetchInvoices();
      }
    } catch (e) {
      console.error('Błąd usuwania faktury:', e);
    }
  };

  const handleFormSave = (savedInv) => {
    setShowForm(false);
    setEditingInvoice(null);
    fetchInvoices();
    handleOpenPrint(savedInv.id);
  };

  const totalGrossSum = invoices.reduce((acc, inv) => acc + (parseFloat(inv.total_gross) || 0), 0);

  if (showForm) {
    return (
      <InvoiceForm
        initialData={editingInvoice}
        onSave={handleFormSave}
        onCancel={() => { setShowForm(false); setEditingInvoice(null); }}
      />
    );
  }

  return (
    <div className="invoices-list-container">
      {/* Top Action Bar */}
      <div className="actions-bar" style={{ display: 'flex', gap: '15px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          className="btn btn-primary"
          style={{ padding: '10px 18px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          onClick={() => { setEditingInvoice(null); setShowForm(true); }}
        >
          + Wystaw Nową Fakturę VAT
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          <div className="entry-counter" style={{ fontSize: '0.85rem', padding: '8px 14px' }}>
            Suma faktur brutto: <strong style={{ color: 'var(--success, #10b981)', marginLeft: '6px' }}>{totalGrossSum.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN</strong>
          </div>

          <input
            type="text"
            className="form-input"
            placeholder="🔎 Szukaj po numerze, nabywcy lub NIP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '280px', padding: '9px 14px', borderRadius: '8px', fontSize: '0.88rem' }}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="table-responsive-container" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
        <table className="table-accounting-modern" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '14px 16px' }}>Numer faktury</th>
              <th style={{ textAlign: 'left', padding: '14px 16px' }}>Data wystawienia</th>
              <th style={{ textAlign: 'left', padding: '14px 16px' }}>Nabywca</th>
              <th style={{ textAlign: 'left', padding: '14px 16px' }}>NIP</th>
              <th className="text-right" style={{ textAlign: 'right', padding: '14px 16px' }}>Kwota Netto</th>
              <th className="text-right" style={{ textAlign: 'right', padding: '14px 16px' }}>Kwota VAT</th>
              <th className="text-right" style={{ textAlign: 'right', padding: '14px 16px' }}>Kwota Brutto</th>
              <th className="text-right" style={{ textAlign: 'center', padding: '14px 16px', width: '160px' }}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Ładowanie faktur sprzedaży...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '35px', color: 'var(--text-muted)' }}>
                  Brak wystawionych faktur. Kliknij <strong>"+ Wystaw Nową Fakturę VAT"</strong>, aby dodać pierwszą fakturę.
                </td>
              </tr>
            ) : (
              invoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ padding: '14px 16px', fontWeight: '700' }}>
                    <span className="inv-no-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px' }}>
                      {inv.invoice_number}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                    {new Date(inv.issue_date).toLocaleDateString('pl-PL')}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: '600' }}>
                    {inv.buyer_name}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>
                    {inv.buyer_nip || '—'}
                  </td>
                  <td className="text-right" style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {parseFloat(inv.total_net).toFixed(2)} zł
                  </td>
                  <td className="text-right" style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>
                    {parseFloat(inv.total_vat).toFixed(2)} zł
                  </td>
                  <td className="text-right" style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                    {parseFloat(inv.total_gross).toFixed(2)} zł
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 10px', fontSize: '0.8rem', fontWeight: '600' }}
                        title="Drukuj / Pobierz PDF"
                        onClick={() => handleOpenPrint(inv.id)}
                      >
                        🖨️ PDF
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 8px', fontSize: '0.8rem' }}
                        title="Edytuj fakturę"
                        onClick={() => handleEdit(inv.id)}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 8px', fontSize: '0.8rem', color: 'var(--danger-color)' }}
                        title="Usuń fakturę"
                        onClick={() => handleDelete(inv.id, inv.invoice_number)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Printable Invoice Modal */}
      {printingInvoice && (
        <InvoicePrintModal
          invoice={printingInvoice}
          onClose={() => setPrintingInvoice(null)}
        />
      )}
    </div>
  );
}
