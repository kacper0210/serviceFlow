import { useState, useEffect } from "react";

export default function OfferForm({ offer, clients, onCancel, onSaved }) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("robocza");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState([
    { title: "", description: "", quantity: 1, unit: "szt.", unit_price_net: 0, vat_rate: 23 }
  ]);

  // If editing, fetch details with items
  useEffect(() => {
    if (offer) {
      const fetchOfferDetails = async () => {
        setLoading(true);
        try {
          const authData = JSON.parse(localStorage.getItem("auth"));
          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/offers/${offer.id}`, {
            headers: { "Authorization": `Bearer ${authData?.token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setClientId(data.client_id || "");
            setTitle(data.title || "");
            setDescription(data.description || "");
            setStatus(data.status || "robocza");
            setNotes(data.notes || "");
            
            if (data.valid_until) {
              // Format date as YYYY-MM-DD
              const d = new Date(data.valid_until);
              const formattedDate = d.toISOString().split("T")[0];
              setValidUntil(formattedDate);
            } else {
              setValidUntil("");
            }

            if (data.items && data.items.length > 0) {
              setItems(data.items.map(item => ({
                title: item.title || "",
                description: item.description || "",
                quantity: parseFloat(item.quantity) || 1,
                unit: item.unit || "szt.",
                unit_price_net: parseFloat(item.unit_price_net) || 0,
                vat_rate: parseInt(item.vat_rate) || 23
              })));
            }
          }
        } catch (err) {
          console.error("Błąd ładowania szczegółów oferty:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchOfferDetails();
    }
  }, [offer]);

  const handleAddItem = () => {
    setItems([
      ...items,
      { title: "", description: "", quantity: 1, unit: "szt.", unit_price_net: 0, vat_rate: 23 }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    let val = value;
    if (field === "quantity") {
      val = value === "" ? "" : parseFloat(value);
    } else if (field === "unit_price_net") {
      val = value === "" ? "" : parseFloat(value);
    } else if (field === "vat_rate") {
      val = parseInt(value);
    }
    newItems[index][field] = val;
    setItems(newItems);
  };

  // Calculations
  const calculateItemAmounts = (item) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseFloat(item.unit_price_net) || 0;
    const net = q * p;
    const vat = net * ((parseInt(item.vat_rate) || 0) / 100);
    const gross = net + vat;
    return {
      net: Math.round(net * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      gross: Math.round(gross * 100) / 100
    };
  };

  const calculatedItems = items.map(item => {
    const amounts = calculateItemAmounts(item);
    return {
      ...item,
      net_amount: amounts.net,
      vat_amount: amounts.vat,
      gross_amount: amounts.gross
    };
  });

  const totalNet = calculatedItems.reduce((sum, item) => sum + item.net_amount, 0);
  const totalVat = calculatedItems.reduce((sum, item) => sum + item.vat_amount, 0);
  const totalGross = calculatedItems.reduce((sum, item) => sum + item.gross_amount, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) {
      alert("Tytuł oferty jest wymagany.");
      return;
    }

    // Verify all items have titles
    const emptyItems = calculatedItems.filter(item => !item.title.trim());
    if (emptyItems.length > 0) {
      alert("Każda pozycja oferty musi posiadać tytuł/nazwę.");
      return;
    }

    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const payload = {
        client_id: clientId === "" ? null : parseInt(clientId),
        title,
        description,
        status,
        valid_until: validUntil === "" ? null : validUntil,
        notes,
        total_net: totalNet,
        total_vat: totalVat,
        total_gross: totalGross,
        items: calculatedItems
      };

      const url = offer
        ? `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/offers/${offer.id}`
        : `${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/offers`;

      const method = offer ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${authData?.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const savedOffer = await res.json();
        alert(offer ? "Oferta została zaktualizowana!" : "Oferta została utworzona!");
        onSaved(savedOffer);
      } else {
        const errData = await res.json();
        alert(`Błąd zapisu: ${errData.error || "Wystąpił błąd"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label>Klient</label>
          <select
            className="form-select"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
          >
            <option value="">-- Wybierz klienta --</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.company_name ? `${c.company_name} (${c.first_name} ${c.last_name})` : `${c.first_name} ${c.last_name}`}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label>Status oferty</label>
          <select
            className="form-select"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="robocza">Robocza</option>
            <option value="wyslana">Wysłana</option>
            <option value="zaakceptowana">Zaakceptowana</option>
            <option value="odrzucona">Odrzucona</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group" style={{ flex: 2 }}>
          <label>Tytuł Oferty *</label>
          <input
            type="text"
            className="form-input"
            placeholder="np. Oferta na wykonanie strony WWW"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-group" style={{ flex: 1 }}>
          <label>Ważna do</label>
          <input
            type="date"
            className="form-input"
            value={validUntil}
            onChange={e => setValidUntil(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label>Opis oferty</label>
        <textarea
          className="form-textarea"
          placeholder="Szczegółowy opis zakresu oferty..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          style={{ minHeight: '80px' }}
        />
      </div>

      <div style={{ marginTop: '10px' }}>
        <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Pozycje oferty</h4>
        <div style={{ overflowX: 'auto' }}>
          <table className="items-form-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Nazwa usługi / produktu *</th>
                <th style={{ width: '10%' }}>Ilość</th>
                <th style={{ width: '10%' }}>Jedn.</th>
                <th style={{ width: '15%' }}>Cena netto</th>
                <th style={{ width: '10%' }}>VAT</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Suma brutto</th>
                <th style={{ width: '5%', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const amounts = calculateItemAmounts(item);
                return (
                  <tr key={index} className="item-row">
                    <td data-label="Nazwa usługi / produktu *">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="np. Projekt graficzny"
                        value={item.title}
                        onChange={e => handleItemChange(index, "title", e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                        required
                      />
                    </td>
                    <td data-label="Ilość">
                      <input
                        type="number"
                        className="form-input"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={e => handleItemChange(index, "quantity", e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                      />
                    </td>
                    <td data-label="Jednostka">
                      <select
                        className="form-select"
                        value={item.unit}
                        onChange={e => handleItemChange(index, "unit", e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                      >
                        <option value="szt.">szt.</option>
                        <option value="godz.">godz.</option>
                        <option value="usł.">usł.</option>
                        <option value="m2">m²</option>
                        <option value="kpl.">kpl.</option>
                      </select>
                    </td>
                    <td data-label="Cena netto (zł)">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          className="form-input"
                          min="0"
                          step="0.01"
                          value={item.unit_price_net}
                          onChange={e => handleItemChange(index, "unit_price_net", e.target.value)}
                          style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>zł</span>
                      </div>
                    </td>
                    <td data-label="Stawka VAT">
                      <select
                        className="form-select"
                        value={item.vat_rate}
                        onChange={e => handleItemChange(index, "vat_rate", e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                      >
                        <option value="23">23%</option>
                        <option value="8">8%</option>
                        <option value="5">5%</option>
                        <option value="0">0%</option>
                      </select>
                    </td>
                    <td data-label="Suma brutto" className="gross-sum-cell" style={{ fontWeight: '600', paddingRight: '10px', fontSize: '0.95rem' }}>
                      {amounts.gross.toFixed(2)} zł
                    </td>
                    <td data-label="Usuń" style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn-remove-item"
                        onClick={() => handleRemoveItem(index)}
                        title="Usuń pozycję"
                        disabled={items.length === 1}
                        style={{ opacity: items.length === 1 ? 0.3 : 1, cursor: items.length === 1 ? 'not-allowed' : 'pointer' }}
                      >
                        ✕ Usuń pozycję
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleAddItem}
          style={{ padding: '8px 20px', fontSize: '0.85rem', width: 'auto', alignSelf: 'flex-start' }}
        >
          + Dodaj kolejną pozycję
        </button>
      </div>

      <div className="offer-totals-box">
        <div className="totals-row">
          <span>Razem Netto:</span>
          <span>{totalNet.toFixed(2)} zł</span>
        </div>
        <div className="totals-row">
          <span>Kwota VAT:</span>
          <span>{totalVat.toFixed(2)} zł</span>
        </div>
        <div className="totals-row">
          <span>Razem Brutto:</span>
          <span>{totalGross.toFixed(2)} zł</span>
        </div>
      </div>

      <div className="form-group">
        <label>Warunki dodatkowe / Uwagi</label>
        <textarea
          className="form-textarea"
          placeholder="np. Sposób płatności, czas realizacji zlecenia, warunki gwarancji..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          style={{ minHeight: '70px' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '15px', marginTop: '10px' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          Anuluj
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Zapisywanie..." : (offer ? "Zapisz zmiany" : "Utwórz ofertę")}
        </button>
      </div>
    </form>
  );
}
