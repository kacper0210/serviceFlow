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

    if (!formData.client_id) {
      alert("Musisz wybrać klienta!");
      return;
    }

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
      alert("Dodano zlecenie!");

    } catch (err) {
      console.error(err);
      alert("Wystąpił błąd przy dodawaniu zlecenia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="order-form-container">
      {showAddClient ? (
        <div style={{ border: "1px dashed #ccc", padding: "10px", borderRadius: "5px", background: "#fafafa" }}>
          <h4>Szybkie dodawanie klienta</h4>
          <AddClientForm onClientAdded={(newClient) => {
            setClients(prev => [...prev, newClient]);
            setFormData(prev => ({ ...prev, client_id: newClient.id }));
            setShowAddClient(false);
          }} />
          <button type="button" onClick={() => setShowAddClient(false)} className="link-btn" style={{ marginTop: 10 }}>
            Anuluj dodawanie klienta
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Tytuł zlecenia *</label>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="form-input"
                required
                placeholder="np. Naprawa laptopa"
              />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label>Cena (PLN)</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className="form-input"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Klient *</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <select
                name="client_id"
                value={formData.client_id}
                onChange={handleChange}
                className="form-select"
                style={{ flex: 1 }}
              >
                <option value="">-- Wybierz klienta --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} {c.company_name ? `(${c.company_name})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowAddClient(true)}
                title="Dodaj nowego klienta"
                style={{ padding: "0 15px", aspectRatio: "1" }}
              >
                +
              </button>

            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Termin (Deadline)</label>
              <input
                type="datetime-local"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="form-select"
              >
                <option value="nowe">Nowe</option>
                <option value="w_trakcie">W realizacji</option>
                <option value="zakonczone">Zakończone</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Opis / Usterka</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="form-textarea"
            />
          </div>

          <div className="form-actions" style={{ marginTop: "20px", textAlign: "right" }}>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Zapisywanie..." : "Dodaj zlecenie"}
            </button>
          </div>

        </form>
      )}
    </div>
  );
}