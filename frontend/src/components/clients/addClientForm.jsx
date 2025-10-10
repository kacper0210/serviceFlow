import { useState } from "react";
import { inputStyle, btnPrimary } from "./clientsStyles";

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
      const res = await fetch("http://localhost:4000/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);

      const data = await res.json();
      if (onClientAdded) onClientAdded(data);

      // Reset formularza
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
      alert("Nie udało się dodać klienta.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        background: "#fff",
        padding: "20px",
        borderRadius: "10px",
        border: "1px solid #ddd",
      }}
    >
      <input name="first_name" placeholder="Imię" value={form.first_name} onChange={handleChange} required style={inputStyle} />
      <input name="last_name" placeholder="Nazwisko" value={form.last_name} onChange={handleChange} style={inputStyle} />
      <input name="phone" placeholder="Telefon" value={form.phone} onChange={handleChange} style={inputStyle} />
      <input name="email" placeholder="Email" value={form.email} onChange={handleChange} style={inputStyle} />

      <select name="type" value={form.type} onChange={handleChange} style={inputStyle}>
        <option value="osoba_prywatna">Osoba prywatna</option>
        <option value="firma">Firma</option>
      </select>

      {form.type === "firma" && (
        <>
          <input name="nip" placeholder="NIP" value={form.nip} onChange={handleChange} style={inputStyle} />
          <input name="company_name" placeholder="Nazwa firmy" value={form.company_name} onChange={handleChange} required style={inputStyle} />
        </>
      )}

      <input name="address" placeholder="Adres" value={form.address} onChange={handleChange} style={inputStyle} />

      <button type="submit" disabled={isSubmitting} style={btnPrimary}>
        {isSubmitting ? "Dodawanie..." : "Dodaj klienta"}
      </button>
    </form>
  );
}
