import { useState, useEffect } from "react";
import {
  inputStyle,
  btnPrimary,
  btnIcon,
  modalOverlay,
  modalBox,
  btnClose,
} from "./ordersStyles";
import AddClientForm from "../clients/addClientForm";

export default function AddOrderForm({ onOrderAdded }) {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);

  // 🔄 Pobranie listy klientów
  const fetchClients = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/clients");
      const data = await res.json();
      setClients(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // 🧾 Dodanie zlecenia
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedClientId || !title.trim()) {
      alert("Wybierz klienta i podaj tytuł zlecenia!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("http://localhost:4000/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          title,
          description,
          status: "nowe",
        }),
      });

      if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);

      const newOrder = await res.json();
      if (onOrderAdded) onOrderAdded(newOrder);

      setTitle("");
      setDescription("");
      setSelectedClientId("");
    } catch (err) {
      console.error(err);
      alert("Nie udało się dodać zlecenia.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🔁 Po dodaniu klienta odśwież listę
  const handleClientAdded = () => {
    fetchClients();
    setShowClientForm(false);
  };

  return (
    <div style={{ position: "relative" }}>
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
        {/* 🔹 Lista klientów z przyciskiem ➕ */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          >
            <option value="">-- Wybierz klienta --</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.first_name} {client.last_name}{" "}
                {client.company_name ? `(${client.company_name})` : ""}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowClientForm(true)}
            style={btnIcon}
            title="Dodaj nowego klienta"
          >
            +
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tytuł zlecenia"
          style={inputStyle}
          required
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opis zlecenia"
          rows="4"
          style={inputStyle}
        />

        <button type="submit" disabled={isSubmitting} style={btnPrimary}>
          {isSubmitting ? "Dodawanie..." : "Dodaj zlecenie"}
        </button>
      </form>

      {/* 🪟 Modal dodania klienta */}
      {showClientForm && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3>Dodaj klienta</h3>
            <AddClientForm onClientAdded={handleClientAdded} />
            <button onClick={() => setShowClientForm(false)} style={btnClose}>
              Zamknij
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
