import { useState } from "react";

export default function AddClientForm({ onClientAdded }) {
  // Stan trzymamy w jednym obiekcie - najprostsze rozwiązanie
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    nip: "",
    address: "",
    type: "osoba_prywatna", // Domyślna wartość
    company_name: "",
  });

  const [loading, setLoading] = useState(false);

  // Funkcja obsługująca zmiany w inputach
  const handleChange = (e) => {
    // Wyciągamy name i value z inputa, który wywołał zdarzenie
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Wysyłka formularza
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Prosta walidacja "na ifach"
    if (formData.type === "firma" && !formData.company_name) {
      alert("Proszę podać nazwę firmy!");
      setLoading(false);
      return;
    }

    console.log("Wysyłanie formularza:", formData); // Debug dla studenta

    try {
      // Pobranie tokena z localStorage (ręcznie, bez helperów)
      const authStorage = localStorage.getItem("auth");
      const token = authStorage ? JSON.parse(authStorage).token : null;

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` // Doklejamy token
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Błąd serwera: " + response.status);
      }

      const createdClient = await response.json();
      console.log("Sukces, dodano:", createdClient);

      // Jeśli komponent nadrzędny przekazał funkcję odświeżającą, to ją wywołaj
      if (onClientAdded) {
        onClientAdded(createdClient);
      }

      // Reset formularza
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

      alert("Dodano nowego klienta!");

    } catch (error) {
      console.error("Błąd zapisu:", error);
      alert("Wystąpił błąd podczas dodawania klienta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="client-form-container">
      <h3>Dodaj nowego klienta</h3>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Imię</label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className="form-input"
              required
              placeholder="Jan"
            />
          </div>

          <div className="form-group">
            <label>Nazwisko</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className="form-input"
              placeholder="Kowalski"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Telefon</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-input"
              placeholder="123 456 789"
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
              placeholder="jan@firma.pl"
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

        {/* Sekcja widoczna tylko dla firm - proste warunkowe renderowanie */}
        {formData.type === "firma" && (
          <div className="company-details-box">
            <div className="form-row">
              <div className="form-group">
                <label>NIP</label>
                <input
                  type="text"
                  name="nip"
                  value={formData.nip}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="000-000-00-00"
                />
              </div>

              <div className="form-group">
                <label>Nazwa Firmy *</label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="Pełna nazwa"
                />
              </div>
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Adres</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="form-input"
            placeholder="Ulica, nr domu, miasto"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Zapisywanie..." : "Dodaj klienta"}
          </button>
        </div>
      </form>
    </div>
  );
}