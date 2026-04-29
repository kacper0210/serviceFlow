import { useState, useEffect } from "react";

export default function AddOrderForm({ onOrderAdded }) {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`)
      .then((res) => res.json())
      .then((data) => setClients(data))
      .catch((err) => console.error(err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedClientId || !title.trim()) {
      alert("Wybierz klienta i podaj tytuł zlecenia!");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId,
          title,
          description,
        }),
      });

      if (!res.ok) throw new Error(`Błąd serwera: ${res.status}`);

      const newOrder = await res.json();
      onOrderAdded(newOrder);

      setTitle("");
      setDescription("");
      setSelectedClientId("");
    } catch (err) {
      console.error(err);
      alert("Nie udało się dodać zlecenia. Spróbuj ponownie.");
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
      <h2 style={{ textAlign: "center", marginBottom: "10px" }}>Dodaj zlecenie</h2>

      <label style={labelStyle}>Klient:</label>
      <div style={{ display: "flex", gap: "8px" }}>
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
          onClick={() => alert("Tutaj otworzymy formularz dodawania klienta (np. w popupie)")}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "none",
            background: "#007bff",
            color: "#fff",
            fontSize: "20px",
            cursor: "pointer",
          }}
        >
          +
        </button>
      </div>

      <label style={labelStyle}>Tytuł zlecenia:</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Np. Naprawa laptopa"
        style={inputStyle}
        required
      />

      <label style={labelStyle}>Opis zlecenia:</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Opisz problem lub zakres prac..."
        rows="4"
        style={{ ...inputStyle, resize: "vertical" }}
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
        {isSubmitting ? "Dodawanie..." : "Dodaj zlecenie"}
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
  backgroundColor: "#fff",
  transition: "border-color 0.2s",
  color: "#222",
};

const labelStyle = {
  fontWeight: "bold",
  fontSize: "14px",
  color: "#222",
};
