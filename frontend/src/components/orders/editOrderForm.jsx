import { useState, useEffect } from "react";

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

  return (
    <div className="order-form-container">
      <h3 style={{ marginTop: 0, textAlign: "center" }}>Edycja zlecenia #{order.id}</h3>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label>Tytuł</label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label>Cena</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Klient</label>
            <select
              name="client_id"
              value={formData.client_id}
              onChange={handleChange}
              className="form-select"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
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
          <label>Opis</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="form-textarea"
          />
        </div>

        <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onCancel} className="btn btn-secondary">Anuluj</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Zapisywanie..." : "Zapisz zmiany"}
          </button>
        </div>

      </form>
    </div>
  );
}