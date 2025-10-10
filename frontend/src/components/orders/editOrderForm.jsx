import { useState } from "react";
import { inputStyle, btnSave, btnCancel } from "./ordersStyles";

export default function EditOrderForm({ order, clients, onCancel, onSaved }) {
  const [form, setForm] = useState(order);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:4000/api/orders/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        onSaved();
        onCancel();
        alert("Zlecenie zaktualizowane.");
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
        name="title"
        value={form.title}
        onChange={handleChange}
        placeholder="Tytuł"
        style={inputStyle}
      />

      <textarea
        name="description"
        value={form.description}
        onChange={handleChange}
        placeholder="Opis"
        style={inputStyle}
      />

      <select
        name="status"
        value={form.status}
        onChange={handleChange}
        style={inputStyle}
      >
        <option value="nowe">Nowe</option>
        <option value="w_trakcie">W trakcie</option>
        <option value="zakończone">Zakończone</option>
      </select>

      <input
        name="price"
        value={form.price || ""}
        onChange={handleChange}
        placeholder="Cena (zł)"
        style={inputStyle}
      />

      <input
        type="datetime-local"
        name="deadline"
        value={form.deadline ? form.deadline.slice(0, 16) : ""}
        onChange={handleChange}
        style={inputStyle}
      />

      <textarea
        name="notes"
        value={form.notes || ""}
        onChange={handleChange}
        placeholder="Notatki"
        style={inputStyle}
      />

      <select
        name="client_id"
        value={form.client_id}
        onChange={handleChange}
        style={inputStyle}
      >
        <option value="">-- Wybierz klienta --</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.first_name} {c.last_name}{" "}
            {c.company_name ? `(${c.company_name})` : ""}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", gap: "8px" }}>
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
