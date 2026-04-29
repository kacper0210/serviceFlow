import { useState } from "react";

export default function AddClientForm({ onClientAdded }) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    nip: "",
    address: "",
    type: "osoba_prywatna",
    company_name: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.type === "firma" && !form.company_name.trim()) {
      alert("Dla firm należy podać nazwę firmy!");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);

      const data = await res.json();
      onClientAdded(data);

      setForm({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        nip: "",
        address: "",
        type: "osoba_prywatna",
        company_name: "",
      });
    } catch (err) {
      console.error(err);
      alert("Nie udało się dodać klienta. Spróbuj ponownie.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: "500px",
        margin: "20px auto",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        background: "#fafafa",
        color: "#222",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "10px" }}>Dodaj klienta</h2>

      <input
        name="first_name"
        placeholder="Imię"
        value={form.first_name}
        onChange={handleChange}
        required
        style={inputStyle}
      />

      <input
        name="last_name"
        placeholder="Nazwisko"
        value={form.last_name}
        onChange={handleChange}
        style={inputStyle}
      />

      <input
        name="phone"
        placeholder="Telefon"
        value={form.phone}
        onChange={handleChange}
        style={inputStyle}
      />

      <input
        name="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        style={inputStyle}
      />

      <select name="type" value={form.type} onChange={handleChange} style={inputStyle}>
        <option value="osoba_prywatna">Osoba prywatna</option>
        <option value="firma">Firma</option>
      </select>

      {form.type === "firma" && (
        <>
          <input
            name="nip"
            placeholder="NIP"
            value={form.nip}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            name="company_name"
            placeholder="Nazwa firmy"
            value={form.company_name}
            onChange={handleChange}
            required
            style={inputStyle}
          />
        </>
      )}

      <input
        name="address"
        placeholder="Adres"
        value={form.address}
        onChange={handleChange}
        style={inputStyle}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          background: isSubmitting ? "#ccc" : "#007bff",
          color: "white",
          padding: "10px",
          border: "none",
          borderRadius: "8px",
          cursor: isSubmitting ? "not-allowed" : "pointer",
          fontSize: "16px",
          transition: "background 0.3s",
        }}
      >
        {isSubmitting ? "Dodawanie..." : "Dodaj kontrahenta"}
      </button>
    </form>
  );
}

const inputStyle = {
  padding: "10px",
  border: "1px solid #ccc",
  borderRadius: "8px",
  fontSize: "15px",
  outline: "none",
  transition: "border-color 0.2s",
  backgroundColor: "#fff",
  color: "#222",
};
