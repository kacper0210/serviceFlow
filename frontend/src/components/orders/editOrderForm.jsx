import { useState } from "react";

export default function EditOrderForm({ order, clients, onCancel, onSaved }) {
  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState({
    id: order.id,
    title: order.title || "",
    client_id: order.client_id || "",
    price: order.price || "",
    deadline: formatDate(order.deadline),
    description: order.description || "",
    status: order.status || "nowe"
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders/${order.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error("Błąd edycji");

      onSaved();

    } catch (err) {
      console.error(err);
      alert("Błąd podczas zapisywania zmian.");
    } finally {
      setLoading(false);
    }
  };

  const getClientOptionLabel = (c) => {
    if (c.company_name) {
      const person = `${c.first_name || ''} ${c.last_name || ''}`.trim();
      return person ? `🏢 ${c.company_name} (${person})` : `🏢 ${c.company_name}`;
    }
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim();
    return fullName ? `👤 ${fullName}` : (c.email || `Klient #${c.id}`);
  };

  return (
    <div className="order-form-container">
      <h3 style={{ marginTop: 0, marginBottom: 18, textAlign: "center" }}>
        Edycja zlecenia <span style={{ color: 'var(--primary-color)' }}>#{order.id}</span>
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="form-row" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: 14 }}>
          <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Tytuł zlecenia *</label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="form-input"
              required
              style={{ width: '100%', height: '42px' }}
            />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '130px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Cena (PLN)</label>
            <input
              type="number"
              step="0.01"
              name="price"
              value={formData.price}
              onChange={handleChange}
              className="form-input"
              style={{ width: '100%', height: '42px' }}
            />
          </div>
        </div>

        <div className="form-row" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: 14 }}>
          <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Klient *</label>
            <select
              name="client_id"
              value={formData.client_id}
              onChange={handleChange}
              className="form-select"
              style={{ width: '100%', height: '42px', borderRadius: '8px' }}
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {getClientOptionLabel(c)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Status zlecenia</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="form-select"
              style={{ width: '100%', height: '42px', borderRadius: '8px' }}
            >
              <option value="nowe">🔵 Nowe</option>
              <option value="w_trakcie">🟠 W realizacji</option>
              <option value="zakonczone">🟢 Zakończone</option>
              <option value="wstrzymane">🔴 Wstrzymane</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Termin realizacji (Deadline)</label>
          <input
            type="datetime-local"
            name="deadline"
            value={formData.deadline}
            onChange={handleChange}
            className="form-input"
            style={{ width: '100%', height: '42px' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Opis / Usterka</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="form-textarea"
            style={{ width: '100%', minHeight: '90px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem' }}
          />
        </div>

        <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" onClick={onCancel} className="btn btn-secondary" style={{ padding: '8px 20px', height: '42px' }}>
            Anuluj
          </button>
          <button type="submit" className="btn btn-primary" style={{ padding: '8px 24px', height: '42px', fontWeight: 700 }} disabled={loading}>
            {loading ? "Zapisywanie..." : "Zapisz zmiany"}
          </button>
        </div>
      </form>
    </div>
  );
}