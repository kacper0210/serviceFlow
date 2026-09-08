import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import './accounting.css';

export default function InvoiceForm({ initialData, orderData, offerData, onSave, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [paymentDays, setPaymentDays] = useState(14);

  const [formData, setFormData] = useState({
    invoice_number: initialData?.invoice_number || '',
    document_type: initialData?.document_type || 'faktura_vat',
    ksef_reference_number: initialData?.ksef_reference_number || '',
    issue_date: initialData?.issue_date ? new Date(initialData.issue_date).toISOString().split('T')[0] : todayStr,
    sale_date: initialData?.sale_date ? new Date(initialData.sale_date).toISOString().split('T')[0] : todayStr,
    payment_deadline: initialData?.payment_deadline ? new Date(initialData.payment_deadline).toISOString().split('T')[0] : defaultDeadline,
    payment_method: initialData?.payment_method || 'przelew',
    bank_account: initialData?.bank_account || '',
    seller_name: initialData?.seller_name || '',
    seller_nip: initialData?.seller_nip || '',
    seller_address: initialData?.seller_address || '',
    buyer_id: initialData?.buyer_id || orderData?.client_id || offerData?.client_id || '',
    buyer_name: initialData?.buyer_name || orderData?.client_name || offerData?.client_name || '',
    buyer_nip: initialData?.buyer_nip || orderData?.client_nip || offerData?.client_nip || '',
    buyer_address: initialData?.buyer_address || orderData?.client_address || offerData?.client_address || '',
    buyer_street: initialData?.buyer_street || '',
    buyer_house_no: initialData?.buyer_house_no || '',
    buyer_apt_no: initialData?.buyer_apt_no || '',
    buyer_postal_code: initialData?.buyer_postal_code || '',
    buyer_city: initialData?.buyer_city || '',
    transaction_description: initialData?.transaction_description || 'Sprzedaż towarów i usług',
    notes: initialData?.notes || '',
    split_payment: initialData?.split_payment || false,
    order_id: initialData?.order_id || orderData?.id || null,
    offer_id: initialData?.offer_id || offerData?.id || null,
  });

  const [items, setItems] = useState(initialData?.items || [
    { name: 'Sprzedaż towarów i usług', quantity: 1, unit: 'szt.', unit_price_net: 0, vat_rate: 23 }
  ]);

  useEffect(() => {
    fetchClients();
    fetchSellerSettings();
    if (!initialData && !formData.invoice_number) {
      fetchNextInvoiceNumber();
    }
  }, []);

  useEffect(() => {
    if (orderData && (!initialData?.items || initialData.items.length === 0)) {
      const net = parseFloat(orderData.price) || 0;
      setItems([{
        name: orderData.title || 'Usługa naprawcza / zlecenia',
        quantity: 1,
        unit: 'szt.',
        unit_price_net: net,
        vat_rate: orderData.vat_rate || 23
      }]);
    } else if (offerData && offerData.items && offerData.items.length > 0) {
      setItems(offerData.items.map(item => ({
        name: item.title || item.name || 'Pozycja',
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || 'szt.',
        unit_price_net: parseFloat(item.unit_price_net) || 0,
        vat_rate: parseInt(item.vat_rate, 10) || 23
      })));
    }
  }, [orderData, offerData]);

  const getAuthHeaders = () => {
    const authData = JSON.parse(localStorage.getItem("auth"));
    const token = authData?.token;
    return {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    };
  };

  const fetchClients = async () => {
    try {
      const res = await fetch(`${API_URL}/api/clients`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (e) {
      console.error('Błąd pobierania klientów:', e);
    }
  };

  const fetchSellerSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/invoices/seller-settings`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({
          ...prev,
          seller_name: prev.seller_name || data.company_name,
          seller_nip: prev.seller_nip || data.nip,
          seller_address: prev.seller_address || `${data.address_line1}, ${data.address_line2}`,
          bank_account: prev.bank_account || data.bank_account
        }));
      }
    } catch (e) {
      console.error('Błąd pobierania ustawień sprzedawcy:', e);
    }
  };

  const fetchNextInvoiceNumber = async () => {
    try {
      const res = await fetch(`${API_URL}/api/invoices/next-number`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, invoice_number: data.suggestedNumber }));
      }
    } catch (e) {
      console.error('Błąd generowania numeru faktury:', e);
    }
  };

  const handlePaymentDaysChange = (daysVal) => {
    const d = parseInt(daysVal, 10);
    setPaymentDays(d);
    if (!isNaN(d) && formData.issue_date) {
      const issueD = new Date(formData.issue_date);
      issueD.setDate(issueD.getDate() + d);
      setFormData(prev => ({ ...prev, payment_deadline: issueD.toISOString().split('T')[0] }));
    }
  };

  const handleIssueDateChange = (dateVal) => {
    setFormData(prev => {
      const newForm = { ...prev, issue_date: dateVal };
      if (dateVal && !isNaN(paymentDays)) {
        const issueD = new Date(dateVal);
        issueD.setDate(issueD.getDate() + paymentDays);
        newForm.payment_deadline = issueD.toISOString().split('T')[0];
      }
      return newForm;
    });
  };

  const handleClientSelect = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) {
      setFormData(prev => ({
        ...prev,
        buyer_id: '',
        buyer_name: '',
        buyer_nip: '',
        buyer_address: '',
        buyer_street: '',
        buyer_house_no: '',
        buyer_apt_no: '',
        buyer_postal_code: '',
        buyer_city: ''
      }));
      return;
    }
    const clientObj = clients.find(c => c.id === parseInt(selectedId, 10));
    if (clientObj) {
      const name = clientObj.type === 'company' ? clientObj.company_name : `${clientObj.first_name || ''} ${clientObj.last_name || ''}`.trim();
      setFormData(prev => ({
        ...prev,
        buyer_id: clientObj.id,
        buyer_name: name,
        buyer_nip: clientObj.nip || '',
        buyer_address: clientObj.address || '',
        buyer_street: clientObj.street || '',
        buyer_house_no: clientObj.house_no || '',
        buyer_apt_no: clientObj.apt_no || '',
        buyer_postal_code: clientObj.postal_code || '',
        buyer_city: clientObj.city || ''
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItemRow = () => {
    setItems([...items, { name: '', quantity: 1, unit: 'szt.', unit_price_net: 0, vat_rate: 23 }]);
  };

  const removeItemRow = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const calculatedItems = items.map(item => {
    const qty = parseFloat(item.quantity) || 0;
    const netPrice = parseFloat(item.unit_price_net) || 0;
    const vatRate = parseInt(item.vat_rate, 10) || 0;

    const netAmount = Math.round(qty * netPrice * 100) / 100;
    const vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100;
    const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;

    return { ...item, netAmount, vatAmount, grossAmount };
  });

  const totalNet = calculatedItems.reduce((acc, curr) => acc + curr.netAmount, 0);
  const totalVat = calculatedItems.reduce((acc, curr) => acc + curr.vatAmount, 0);
  const totalGross = calculatedItems.reduce((acc, curr) => acc + curr.grossAmount, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.buyer_name || !formData.invoice_number) {
      alert('Uzupełnij nazwę nabywcy oraz numer faktury.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        items
      };

      const url = initialData ? `${API_URL}/api/invoices/${initialData.id}` : `${API_URL}/api/invoices`;
      const method = initialData ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const savedInvoice = await res.json();
        if (onSave) onSave(savedInvoice);
      } else {
        const errData = await res.json();
        alert(`Błąd zapisu: ${errData.error || 'Nieznany błąd'}`);
      }
    } catch (err) {
      console.error('Błąd wystawiania faktury:', err);
      alert('Wystąpił błąd podczas połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invoice-form-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ margin: 0, color: 'var(--primary-color, #4f46e5)', fontWeight: '700' }}>
          {initialData ? '🖊️ Edycja Faktury VAT' : '📄 Nowa Faktura Sprzedaży (mOrganizer)'}
        </h3>
        <button className="btn btn-secondary" onClick={onCancel} style={{ padding: '6px 14px' }}>
          ✕ Zamknij
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* SECTION 1: KONTRAHENT & KOMPLETNY ADRES */}
        <div style={{ marginBottom: '24px', padding: '18px', background: 'var(--bg-gray, #f4f4f5)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            👤 1. Kontrahent i Adres Siedziby
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Wybierz kontrahenta z bazy:</label>
              <select className="form-select" value={formData.buyer_id} onChange={handleClientSelect} style={{ width: '100%', padding: '9px 12px', borderRadius: '6px' }}>
                <option value="">-- Wybierz istniejącego klienta lub wpisz poniżej --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.type === 'company' ? c.company_name : `${c.first_name} ${c.last_name}`} {c.nip ? `(NIP: ${c.nip})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>NIP kontrahenta:</label>
              <input
                type="text"
                className="form-input"
                placeholder="np. 6721724837"
                value={formData.buyer_nip}
                onChange={e => setFormData({ ...formData, buyer_nip: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Pełna Nazwa Kontrahenta / Imię i Nazwisko *</label>
            <input
              type="text"
              className="form-input"
              placeholder="np. WSPÓLNOTA MIESZKANIOWA NIERUCHOMOŚCI PRZY UL. KOŚCIUSZKI 5"
              value={formData.buyer_name}
              onChange={e => setFormData({ ...formData, buyer_name: e.target.value })}
              required
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', fontWeight: '600' }}
            />
          </div>

          {/* Osobne pola na kompletny adres z mOrganizer */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Ulica:</label>
              <input
                type="text"
                className="form-input"
                placeholder="np. Koszalińska / Wojska Polskiego"
                value={formData.buyer_street}
                onChange={e => setFormData({ ...formData, buyer_street: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Nr domu:</label>
              <input
                type="text"
                className="form-input"
                placeholder="np. 12"
                value={formData.buyer_house_no}
                onChange={e => setFormData({ ...formData, buyer_house_no: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Nr lokalu:</label>
              <input
                type="text"
                className="form-input"
                placeholder="np. 1"
                value={formData.buyer_apt_no}
                onChange={e => setFormData({ ...formData, buyer_apt_no: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Kod pocztowy:</label>
              <input
                type="text"
                className="form-input"
                placeholder="np. 78-230"
                value={formData.buyer_postal_code}
                onChange={e => setFormData({ ...formData, buyer_postal_code: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Miejscowość:</label>
              <input
                type="text"
                className="form-input"
                placeholder="np. Karlino"
                value={formData.buyer_city}
                onChange={e => setFormData({ ...formData, buyer_city: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Lub skonsolidowany pełny adres (opcjonalnie):</label>
            <textarea
              className="form-textarea"
              rows="2"
              placeholder="np. ul. Koszalińska 12/1, 78-230 Karlino"
              value={formData.buyer_address}
              onChange={e => setFormData({ ...formData, buyer_address: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* SECTION 2: TYP DOKUMENTU, NUMER FAKTURY I DATY */}
        <div style={{ marginBottom: '24px', padding: '18px', background: 'var(--bg-gray, #f4f4f5)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📅 2. Typ Dokumentu, Numery i Daty
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Typ dokumentu:</label>
              <select
                className="form-select"
                value={formData.document_type}
                onChange={e => setFormData({ ...formData, document_type: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', fontWeight: '600' }}
              >
                <option value="faktura_vat">Faktura VAT (Sprzedaż A)</option>
                <option value="faktura_zaliczkowa">Faktura Zaliczkowa</option>
                <option value="faktura_koncowa">Faktura Końcowa</option>
                <option value="faktura_proforma">Faktura Proforma</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Numer dokumentu *</label>
              <input
                type="text"
                className="form-input"
                value={formData.invoice_number}
                onChange={e => setFormData({ ...formData, invoice_number: e.target.value })}
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', fontWeight: '700' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Numer KSeF (opcjonalnie):</label>
              <input
                type="text"
                className="form-input"
                placeholder="np. 6722109643-20260825-..."
                value={formData.ksef_reference_number}
                onChange={e => setFormData({ ...formData, ksef_reference_number: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Data wystawienia *</label>
              <input
                type="date"
                className="form-input"
                value={formData.issue_date}
                onChange={e => handleIssueDateChange(e.target.value)}
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Data sprzedaży *</label>
              <input
                type="date"
                className="form-input"
                value={formData.sale_date}
                onChange={e => setFormData({ ...formData, sale_date: e.target.value })}
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Termin płatności (dni):</label>
              <select
                className="form-select"
                value={paymentDays}
                onChange={e => handlePaymentDaysChange(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', fontWeight: '600' }}
              >
                <option value="0">0 dni (Gotówka / Natychmiast)</option>
                <option value="7">7 dni</option>
                <option value="14">14 dni</option>
                <option value="21">21 dni</option>
                <option value="30">30 dni</option>
                <option value="60">60 dni</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px' }}>Data terminu płatności *</label>
              <input
                type="date"
                className="form-input"
                value={formData.payment_deadline}
                onChange={e => setFormData({ ...formData, payment_deadline: e.target.value })}
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', fontWeight: '600' }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: POZYCJE DOKUMENTU */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🛒 3. Pozycje Dokumentu
          </h4>
          <div className="table-responsive-container" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <table className="table-accounting-modern" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>Lp.</th>
                  <th>Opis pozycji</th>
                  <th style={{ width: '90px' }}>Ilość</th>
                  <th style={{ width: '70px' }}>J. m.</th>
                  <th style={{ width: '120px' }}>Cena netto</th>
                  <th style={{ width: '80px' }}>Stawka VAT</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Netto</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Kwota brutto</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {calculatedItems.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', fontWeight: '700' }}>{idx + 1}</td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Opis towarów i usług"
                        value={item.name}
                        onChange={e => handleItemChange(idx, 'name', e.target.value)}
                        required
                        style={{ width: '100%', padding: '6px 10px', fontSize: '0.88rem' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={item.quantity}
                        onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', textAlign: 'right' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        value={item.unit}
                        onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={item.unit_price_net}
                        onChange={e => handleItemChange(idx, 'unit_price_net', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', textAlign: 'right' }}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select"
                        value={item.vat_rate}
                        onChange={e => handleItemChange(idx, 'vat_rate', e.target.value)}
                        style={{ width: '100%', padding: '6px 4px' }}
                      >
                        <option value="23">23%</option>
                        <option value="8">8%</option>
                        <option value="5">5%</option>
                        <option value="0">0%</option>
                      </select>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>{item.netAmount.toFixed(2)} zł</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success, #10b981)' }}>{item.grossAmount.toFixed(2)} zł</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length <= 1}
                        style={{ padding: '4px 8px', color: 'var(--danger-color)' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="btn btn-secondary" onClick={addItemRow} style={{ marginTop: '10px', fontSize: '0.85rem' }}>
            + Dodaj kolejną pozycję
          </button>
        </div>

        {/* SECTION 4: OPIS TRANSAKCJI GOSPODARCZEJ I UWAGI */}
        <div style={{ marginBottom: '24px', padding: '18px', background: 'var(--bg-gray, #f4f4f5)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📝 4. Opis Transakcji Gospodarczej i Uwagi (Drukowane na fakturze)
          </h4>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Opis transakcji gospodarczej:</label>
            <input
              type="text"
              className="form-input"
              placeholder="np. Sprzedaż towarów i usług / Naprawa drzwi"
              value={formData.transaction_description}
              onChange={e => setFormData({ ...formData, transaction_description: e.target.value })}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Uwagi na fakturze (dla nabywcy):</label>
            <textarea
              className="form-textarea"
              rows="3"
              placeholder="Wpisz tu dodatkowe uwagi, warunki gwarancji lub adnotacje widoczne na wygenerowanej fakturze PDF..."
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px' }}
            />
          </div>
        </div>

        {/* SECTION 5: PŁATNOŚĆ I OPCJE DODATKOWE */}
        <div style={{ marginBottom: '24px', padding: '18px', background: 'var(--bg-gray, #f4f4f5)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            💳 5. Płatność i Opcje Dodatkowe
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Rodzaj płatności:</label>
              <select
                className="form-select"
                value={formData.payment_method}
                onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px' }}
              >
                <option value="przelew">Przelew bankowy</option>
                <option value="gotówka">Gotówka</option>
                <option value="karta">Karta płatnicza</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Konto bankowe sprzedawcy:</label>
              <input
                type="text"
                className="form-input"
                value={formData.bank_account}
                onChange={e => setFormData({ ...formData, bank_account: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', fontFamily: 'monospace' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <input
              type="checkbox"
              id="split_payment"
              checked={formData.split_payment}
              onChange={e => setFormData({ ...formData, split_payment: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="split_payment" style={{ cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem' }}>
              Mechanizm podzielonej płatności (Split payment)
            </label>
          </div>
        </div>

        {/* Sums Summary Box */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <div style={{ background: 'var(--bg-gray, #f4f4f5)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px 20px', width: '340px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem' }}>
              <span>Suma Netto:</span>
              <strong>{totalNet.toFixed(2)} PLN</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.88rem' }}>
              <span>Suma VAT:</span>
              <strong>{totalVat.toFixed(2)} PLN</strong>
            </div>
            <hr style={{ margin: '10px 0', borderColor: 'var(--border-color)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: '800', color: 'var(--success, #10b981)' }}>
              <span>Do zapłaty (Brutto):</span>
              <span>{totalGross.toFixed(2)} PLN</span>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ padding: '10px 20px' }}>
            Anuluj
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '10px 24px', fontWeight: '700' }}>
            {loading ? 'Zapisywanie...' : '💾 Zapisz i Wygeneruj Fakturę'}
          </button>
        </div>
      </form>
    </div>
  );
}
