import { useState } from "react";
import { formatPhoneInput } from "./utils";

export default function AddClientForm({ onClientAdded, hideHeader = false }) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    nip: "",
    address: "",
    type: "osoba_prywatna",
    company_name: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "phone") {
      setFormData((prev) => ({
        ...prev,
        phone: formatPhoneInput(value),
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (formData.type === "firma" && !formData.company_name) {
      alert("Proszę podać nazwę firmy!");
      setLoading(false);
      return;
    }

    try {
      const authStorage = localStorage.getItem("auth");
      const token = authStorage ? JSON.parse(authStorage).token : null;

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Błąd serwera: " + response.status);
      }

      const createdClient = await response.json();

      if (onClientAdded) {
        onClientAdded(createdClient);
      }

      setFormData({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        nip: "",
        address: "",
        type: "osoba_prywatna",
        company_name: "",
      });

    } catch (error) {
      console.error("Błąd zapisu:", error);
      alert("Wystąpił błąd podczas dodawania klienta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="client-form-container">
      {!hideHeader && <h3 style={{ marginTop: 0, marginBottom: 16 }}>Dodaj nowego klienta</h3>}

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Typ klienta</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="form-select"
            style={{ width: '100%', height: '42px', borderRadius: '8px' }}
          >
            <option value="osoba_prywatna">👤 Osoba prywatna</option>
            <option value="firma">🏢 Firma (B2B)</option>
          </select>
        </div>

        {formData.type === "firma" && (
          <div className="company-details-box" style={{ background: 'rgba(79, 70, 229, 0.04)', padding: '14px', borderRadius: '10px', marginBottom: '14px', border: '1px solid rgba(79, 70, 229, 0.15)' }}>
            <div className="form-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>NIP</label>
                <input
                  type="text"
                  name="nip"
                  value={formData.nip}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="000-000-00-00"
                  style={{ width: '100%', height: '40px' }}
                />
              </div>

              <div className="form-group" style={{ flex: 2, minWidth: '180px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Nazwa Firmy *</label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Pełna nazwa firmy Sp. z o.o."
                  required={formData.type === "firma"}
                  style={{ width: '100%', height: '40px' }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="form-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: 14 }}>
          <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Imię</label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className="form-input"
              required={formData.type !== "firma"}
              placeholder="Jan"
              style={{ width: '100%', height: '40px' }}
            />
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Nazwisko</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className="form-input"
              placeholder="Kowalski"
              style={{ width: '100%', height: '40px' }}
            />
          </div>
        </div>

        <div className="form-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: 14 }}>
          <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Telefon</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-input"
              placeholder="+48-517-190-673"
              style={{ width: '100%', height: '40px' }}
            />
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="form-input"
              placeholder="jan@firma.pl"
              style={{ width: '100%', height: '40px' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Adres</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="form-input"
            placeholder="Ulica, nr domu, miasto"
            style={{ width: '100%', height: '40px' }}
          />
        </div>

        <div className="form-actions" style={{ textAlign: "right" }}>
          <button type="submit" className="btn btn-primary" style={{ width: "100%", height: "42px", fontWeight: 600 }} disabled={loading}>
            {loading ? "Dodawanie..." : "+ Dodaj klienta"}
          </button>
        </div>
      </form>
    </div>
  );
}