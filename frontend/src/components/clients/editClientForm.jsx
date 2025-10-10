import { useState } from "react";
import { inputStyle, btnSave, btnCancel } from "./clientsStyles";

export default function EditClientForm({ client, onCancel, onSaved }) {
  const [form, setForm] = useState(client);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:4000/api/clients/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        onSaved();
        onCancel();
      } else {
        alert("Nie udało się zapisać zmian.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "8px" }}>
      <input
        name="first_name"
        placeholder="Imię"
        value={form.first_name}
        onChange={handleChange}
        style={inputStyle}
        required
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
        value={form.phone || ""}
        onChange={handleChange}
        style={inputStyle}
      />
      <input
        name="email"
        placeholder="Email"
        value={form.email || ""}
        onChange={handleChange}
        style={inputStyle}
      />
      <select
        name="type"
        value={form.type}
        onChange={handleChange}
        style={inputStyle}
      >
        <option value="osoba_prywatna">Osoba prywatna</option>
        <option value="firma">Firma</option>
      </select>

      {form.type === "firma" && (
        <>
          <input
            name="nip"
            placeholder="NIP"
            value={form.nip || ""}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            name="company_name"
            placeholder="Nazwa firmy"
            value={form.company_name || ""}
            onChange={handleChange}
            style={inputStyle}
          />
        </>
      )}

      <input
        name="address"
        placeholder="Adres"
        value={form.address || ""}
        onChange={handleChange}
        style={inputStyle}
      />

      <div style={{ display: "flex", gap: "10px" }}>
        <button type="submit" style={btnSave}>
          💾 Zapisz
        </button>
        <button type="button" onClick={onCancel} style={btnCancel}>
          ✖ Anuluj
        </button>
      </div>
    </form>
  );
}
