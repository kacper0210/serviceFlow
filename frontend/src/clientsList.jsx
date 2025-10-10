import { useEffect, useState } from "react";

export default function ClientsList() {
  const [clients, setClients] = useState([]);
  const [editingClient, setEditingClient] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Pobieranie klientów
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

  // Usuwanie klienta
  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tego klienta?")) return;
    try {
      const res = await fetch(`http://localhost:4000/api/clients/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        setClients(clients.filter((c) => c.id !== id));
        alert("Klient został usunięty.");
      } else if (res.status === 400 && data.assignedOrders) {
        const ordersList = data.assignedOrders
          .map((o) => `• ${o.title} (ID: ${o.id})`)
          .join("\n");
        alert(
          `Nie można usunąć klienta, ponieważ ma przypisane zlecenia:\n\n${ordersList}`
        );
      } else {
        alert(data.error || "Nie udało się usunąć klienta.");
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem.");
    }
  };

  // Rozpoczęcie edycji
  const handleEdit = (client) => {
    setEditingClient(client.id);
    setEditForm({ ...client });
  };

  // Zmiana wartości w formularzu edycji
  const handleChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // Zapis zmian
  const handleSave = async (id) => {
    try {
      const res = await fetch(`http://localhost:4000/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingClient(null);
        fetchClients();
      } else {
        alert("Nie udało się zapisać zmian");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {clients.map((client) => (
        <li
          key={client.id}
          style={{
            marginBottom: "15px",
            padding: "15px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            background: "#fff",
            color: "#222",
          }}
        >
          {editingClient === client.id ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave(client.id);
              }}
              style={{
                display: "grid",
                gap: "8px",
              }}
            >
              <input
                name="first_name"
                placeholder="Imię"
                value={editForm.first_name}
                onChange={handleChange}
                style={inputStyle}
                required
              />

              <input
                name="last_name"
                placeholder="Nazwisko"
                value={editForm.last_name}
                onChange={handleChange}
                style={inputStyle}
              />

              <input
                name="phone"
                placeholder="Telefon"
                value={editForm.phone || ""}
                onChange={handleChange}
                style={inputStyle}
              />

              <input
                name="email"
                placeholder="Email"
                value={editForm.email || ""}
                onChange={handleChange}
                style={inputStyle}
              />

              <select
                name="type"
                value={editForm.type}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="osoba_prywatna">Osoba prywatna</option>
                <option value="firma">Firma</option>
              </select>

              {editForm.type === "firma" && (
                <>
                  <input
                    name="nip"
                    placeholder="NIP"
                    value={editForm.nip || ""}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                  <input
                    name="company_name"
                    placeholder="Nazwa firmy"
                    value={editForm.company_name || ""}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </>
              )}

              <input
                name="address"
                placeholder="Adres"
                value={editForm.address || ""}
                onChange={handleChange}
                style={inputStyle}
              />

              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" style={btnSave}>
                  💾 Zapisz
                </button>
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  style={btnCancel}
                >
                  ✖ Anuluj
                </button>
              </div>
            </form>
          ) : (
            <>
              <strong>
                {client.first_name} {client.last_name}
              </strong>
              <br />
              <span>{client.email}</span>
              <br />
              <small>{client.type}</small>
              <br />
              {client.company_name && (
                <>
                  <span>{client.company_name}</span>
                  <br />
                </>
              )}
              {client.phone && (
                <>
                  <span>📞 {client.phone}</span>
                  <br />
                </>
              )}
              {client.address && <span>📍 {client.address}</span>}
              <div style={{ marginTop: "10px" }}>
                <button onClick={() => handleEdit(client)} style={btnEdit}>
                  ✏️ Edytuj
                </button>
                <button onClick={() => handleDelete(client.id)} style={btnDelete}>
                  🗑️ Usuń
                </button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

const inputStyle = {
  padding: "8px",
  border: "1px solid #ccc",
  borderRadius: "6px",
  width: "100%",
};

const btnEdit = {
  marginRight: "8px",
  background: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "6px 10px",
  cursor: "pointer",
};

const btnDelete = {
  background: "#dc3545",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "6px 10px",
  cursor: "pointer",
};

const btnSave = {
  ...btnEdit,
  background: "#28a745",
};

const btnCancel = {
  ...btnDelete,
  background: "#6c757d",
};
