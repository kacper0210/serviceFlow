import { useState, useEffect } from "react";

export default function AddEntryForm({ type, onSaved, onCancel, initialData }) {
  const [form, setForm] = useState({
    date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    number: initialData?.number || "",
    contractor: initialData?.contractor || "",
    description: initialData?.description || "",
    net_amount: initialData?.net_amount || "",
    vat_rate: initialData?.vat_rate || 23,
    vat_amount: initialData?.vat_amount || "",
    gross_amount: initialData?.gross_amount || "",
    category: initialData?.category || (type === "revenue" ? "Sprzedaż" : "Inne"),
    is_car_cost: initialData?.is_car_cost || false,
    entry_type: initialData?.entry_type || type
  });

  const [loading, setLoading] = useState(false);

  // Auto-calculate VAT and Gross
  useEffect(() => {
    const net = parseFloat(form.net_amount) || 0;
    const rate = parseInt(form.vat_rate) || 0;
    const vat = Math.round(net * (rate / 100) * 100) / 100;
    const gross = Math.round((net + vat) * 100) / 100;

    setForm(prev => ({
      ...prev,
      vat_amount: vat,
      gross_amount: gross
    }));
  }, [form.net_amount, form.vat_rate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const url = initialData 
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/entries/${initialData.id}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/entries`;
      
      const res = await fetch(url, {
        method: initialData ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(form)
      });
      if (res.ok) onSaved();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="expense-form">
      <h3>
        {initialData ? "Edytuj wpis" : (type === "revenue" ? "Dodaj Fakturę Sprzedaży" : "Dodaj Wydatek / Fakturę")}
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Data wystawienia</label>
            <input 
              type="date" 
              className="form-input" 
              value={form.date} 
              onChange={e => setForm({...form, date: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>{type === "revenue" ? "Numer faktury" : "Numer dokumentu"}</label>
            <input 
              className="form-input" 
              value={form.number} 
              onChange={e => setForm({...form, number: e.target.value})}
              required
              placeholder={type === "revenue" ? "np. FV 1/2024" : "np. FV/2024/01/01"}
            />
          </div>
        </div>

        <div className="form-group">
          <label>{type === "revenue" ? "Klient" : "Kontrahent / Nazwa firmy"}</label>
          <input 
            className="form-input" 
            value={form.contractor} 
            onChange={e => setForm({...form, contractor: e.target.value})}
            placeholder={type === "revenue" ? "Nazwa klienta" : "np. Orlen, Media Expert itp."}
          />
        </div>


        <div className="form-row">
          <div className="form-group" style={{flex: 2}}>
            <label>Kwota Netto</label>
            <input 
              type="number" 
              step="0.01" 
              className="form-input" 
              value={form.net_amount} 
              onChange={e => setForm({...form, net_amount: e.target.value})}
              required
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label>Stawka VAT (%)</label>
            <select 
              className="form-select" 
              value={form.vat_rate} 
              onChange={e => setForm({...form, vat_rate: e.target.value})}
            >
              <option value={23}>23%</option>
              <option value={8}>8%</option>
              <option value={5}>5%</option>
              <option value={0}>0% / zw</option>
            </select>
          </div>
        </div>

        <div className="stats-box-mini">
            <div>VAT: <strong>{form.vat_amount} zł</strong></div>
            <div>Brutto: <strong>{form.gross_amount} zł</strong></div>
        </div>

        <div className="form-row">
            <div className="form-group">
                <label>Kategoria</label>
                <select 
                    className="form-select"
                    value={form.category}
                    onChange={e => setForm({...form, category: e.target.value})}
                >
                    <option value="Inne">Inne</option>
                    <option value="Paliwo / Auto">Paliwo / Auto</option>
                    <option value="Media / Internet">Media / Internet</option>
                    <option value="Narzędzia">Narzędzia</option>
                    <option value="Marketing">Marketing</option>
                </select>
            </div>
            <div className="form-group flex-center-v" style={{paddingTop: '25px'}}>
                {type === "expense" && (
                  <label className="checkbox-label-modern">
                    <input 
                        type="checkbox" 
                        checked={form.is_car_cost}
                        onChange={e => setForm({...form, is_car_cost: e.target.checked})}
                    />
                    <span>Koszt pojazdu (Mieszany)</span>
                  </label>
                )}
            </div>

        </div>

        <div className="form-actions" style={{marginTop: '20px', justifyContent: 'flex-end', display: 'flex', gap: '10px'}}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Anuluj</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Zapisywanie..." : "Zapisz Wydatek"}
          </button>
        </div>
      </form>
    </div>
  );
}
