import { useState } from "react";

export default function EditClientForm({ client, onCancel, onSaved }) {
  const [formData, setFormData] = useState({
    id: client.id,
    first_name: client.first_name || "",
    last_name: client.last_name || "",
    phone: client.phone || "",
    email: client.email || "",
    nip: client.nip || "",
    address: client.address || "",
    type: client.type || "osoba_prywatna",
    company_name: client.company_name || ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (formData.type === "firma" && !formData.company_name) {
      alert("Firma musi mieć nazwę!");
      setLoading(false);
      return;
    }

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients/${formData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error("Błąd podczas aktualizacji danych");
      }

      onSaved();

    } catch (err) {
      console.error(err);
      setError("Nie udało się zapisać zmian.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="client-form-container">
      <h3 style={{ textAlign: "center", marginTop: 0 }}>Edycja danych</h3>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Imię *</label>
            <input
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label>Nazwisko</label>
            <input
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Telefon</label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="form-input"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Typ klienta</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="form-select"
          >
            <option value="osoba_prywatna">Osoba prywatna</option>
            <option value="firma">Firma</option>
          </select>
        </div>

        {formData.type === "firma" && (
          <div className="company-details-box">
            <div className="form-row">
              <div className="form-group">
                <label>Nazwa firmy *</label>
                <input
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>NIP</label>
                <input
                  name="nip"
                  value={formData.nip}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Adres</label>
          <input
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="form-input"
          />
        </div>

        <div className="form-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
            Anuluj
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Zapisywanie..." : "Zapisz zmiany"}
          </button>
        </div>
      </form>
    </div>
  );
}