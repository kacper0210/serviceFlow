import { useState, useEffect } from "react";
import AddClientForm from "../clients/addClientForm";

export default function AddOrderForm({ onOrderAdded }) {
  const [formData, setFormData] = useState({
    title: "",
    client_id: "",
    price: "",
    deadline: "",
    description: "",
    status: "nowe"
  });

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  const fetchClients = async () => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`, {
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error("Błąd pobierania klientów", err);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) throw new Error("Błąd zapisu");

      const newOrder = await res.json();

      onOrderAdded(newOrder);
      setFormData({
        title: "", client_id: "", price: "", deadline: "", description: "", status: "nowe"
      });

    } catch (err) {
      console.error(err);
      alert("Wystąpił błąd przy dodawaniu zlecenia.");
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
      {showAddClient ? (
        <div style={{ 
          border: "1px solid var(--border-color)", 
          padding: "20px", 
          borderRadius: "12px", 
          background: "var(--bg-gray)",
          marginBottom: "16px"
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary-color)' }}>
              ⚡ Szybkie dodawanie nowego klienta
            </h4>
            <button 
              type="button" 
              onClick={() => setShowAddClient(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}
            >
              ✕
            </button>
          </div>

          <AddClientForm 
            hideHeader={true}
            onClientAdded={(newClient) => {
              setClients(prev => [...prev, newClient]);
              setFormData(prev => ({ ...prev, client_id: String(newClient.id) }));
              setShowAddClient(false);
            }} 
          />

          <button 
            type="button" 
            onClick={() => setShowAddClient(false)} 
            className="btn btn-secondary-outline" 
            style={{ width: '100%', marginTop: '12px', padding: '8px' }}
          >
            Anuluj dodawanie klienta
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-row" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: 14 }}>
            <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                Tytuł zlecenia *
              </label>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="form-input"
                required
                placeholder="np. Naprawa laptopa Dell, Montaż sieci..."
                style={{ width: '100%', height: '42px' }}
              />
            </div>

            <div className="form-group" style={{ flex: 1, minWidth: '130px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                Cena (PLN)
              </label>
              <input
                type="number"
                step="0.01"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className="form-input"
                placeholder="0.00 zł"
                style={{ width: '100%', height: '42px' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              Klient *
            </label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <select
                name="client_id"
                value={formData.client_id}
                onChange={handleChange}
                className="form-select"
                style={{ flex: 1, minWidth: '200px', height: '42px', borderRadius: '8px' }}
              >
                <option value="">-- Brak klienta (opcjonalnie) --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {getClientOptionLabel(c)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary-outline"
                onClick={() => setShowAddClient(true)}
                title="Dodaj nowego klienta"
                style={{ height: '42px', padding: '0 16px', whiteSpace: 'nowrap', fontWeight: 600 }}
              >
                + Nowy klient
              </button>
            </div>
          </div>

          <div className="form-row" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: 14 }}>
            <div className="form-group" style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                Termin realizacji (Deadline)
              </label>
              <input
                type="datetime-local"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="form-input"
                style={{ width: '100%', height: '42px' }}
              />
            </div>

            <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
                Status zlecenia
              </label>
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

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>
              Opis / Szczegóły usterki
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-textarea"
              placeholder="Opisz problem, użyty sprzęt, zakres prac..."
              style={{ width: '100%', minHeight: '90px', padding: '10px 12px', borderRadius: '8px', fontSize: '0.9rem' }}
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" style={{ width: "100%", height: "44px", fontWeight: 700, fontSize: '0.95rem' }} disabled={loading}>
              {loading ? "Zapisywanie..." : "+ Dodaj zlecenie"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}