import { useEffect, useState } from "react";
import ClientDetails from "./clientDetails";
import { fetchClientsFromApi } from "./utils";
import { btnEdit, btnDelete } from "./clientsStyles";

export default function ClientsList({ refreshTrigger }) {
  const [clients, setClients] = useState([]);
  const [editingClient, setEditingClient] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);

  // 🔄 Pobieranie klientów
  const fetchClients = async () => {
    setIsLoading(true);
    const data = await fetchClientsFromApi();
    if (data) setClients(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [refreshTrigger]);

  // 🗑️ Usuwanie klienta
  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tego klienta?")) return;

    try {
      const res = await fetch(`http://localhost:4000/api/clients/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok) {
        setClients((prev) => prev.filter((c) => c.id !== id));
        alert("Klient został usunięty.");
      } else if (res.status === 400 && data.assignedOrders) {
        const ordersList = data.assignedOrders
          .map((o) => `• ${o.title} (ID: ${o.id})`)
          .join("\n");
        alert(
          `Nie można usunąć klienta, ponieważ ma przypisane zlecenia:\n\n${ordersList}`
        );
      } else {
        alert("Nie udało się usunąć klienta.");
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem.");
    }
  };

  // ✏️ Edycja klienta
  const handleEdit = (client) => {
    setEditingClient(client.id);
    setEditForm({ ...client });
  };

  const handleChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

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

  if (isLoading) {
    return (
      <p style={{ color: "#ccc", textAlign: "center" }}>
        Ładowanie klientów...
      </p>
    );
  }

  return (
    <>
      {/* 🔍 Modal szczegółów klienta */}
      {selectedClientId && (
        <ClientDetails
          clientId={selectedClientId}
          onClose={() => setSelectedClientId(null)}
        />
      )}

      {/* 📋 Tabela klientów */}
      <div style={tableContainer}>
        <div style={tableHeader}>
          <span>Imię</span>
          <span>Nazwisko</span>
          <span>Email</span>
          <span>Telefon</span>
          <span>Typ</span>
          <span>Firma</span>
          <span>Akcje</span>
        </div>

        {clients.map((client) => (
          <div
            key={client.id}
            style={{
              ...tableRow,
              background:
                editingClient === client.id ? "#f8f9fa" : "white",
            }}
          >
            {editingClient === client.id ? (
              <>
                <input
                  name="first_name"
                  value={editForm.first_name}
                  onChange={handleChange}
                  style={inputStyle}
                />
                <input
                  name="last_name"
                  value={editForm.last_name}
                  onChange={handleChange}
                  style={inputStyle}
                />
                <input
                  name="email"
                  value={editForm.email || ""}
                  onChange={handleChange}
                  style={inputStyle}
                />
                <input
                  name="phone"
                  value={editForm.phone || ""}
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
                <input
                  name="company_name"
                  value={editForm.company_name || ""}
                  onChange={handleChange}
                  style={inputStyle}
                />
                <div style={{ display: "flex", gap: "5px" }}>
                  <button onClick={() => handleSave(client.id)} style={btnSave}>
                    💾
                  </button>
                  <button
                    onClick={() => setEditingClient(null)}
                    style={btnCancel}
                  >
                    ✖
                  </button>
                </div>
              </>
            ) : (
              <>
                <span
                  onClick={() => setSelectedClientId(client.id)}
                  style={{ cursor: "pointer", color: "#007bff" }}
                >
                  {client.first_name}
                </span>
                <span>{client.last_name}</span>
                <span>{client.email || "-"}</span>
                <span>{client.phone || "-"}</span>
                <span>
                  {client.type === "firma" ? "Firma" : "Osoba prywatna"}
                </span>
                <span>{client.company_name || "-"}</span>
                <div style={{ display: "flex", gap: "5px" }}>
                  <button onClick={() => handleEdit(client)} style={btnEdit}>
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    style={btnDelete}
                  >
                    🗑️
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// 🎨 Style
const tableContainer = {
  background: "#fff",
  borderRadius: "10px",
  overflow: "hidden",
  boxShadow: "0 0 5px rgba(0,0,0,0.1)",
  marginTop: "10px",
  color:"#222"
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1.5fr 1fr 1fr 1fr auto",
  background: "#382e2e",
  color: "white",
  fontWeight: "bold",
  padding: "10px",
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1.5fr 1fr 1fr 1fr auto",
  padding: "10px",
  borderBottom: "1px solid #ddd",
  alignItems: "center",
};

const inputStyle = {
  padding: "6px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  width: "100%",
};

const btnSave = {
  background: "#28a745",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "5px 8px",
  cursor: "pointer",
};

const btnCancel = {
  background: "#6c757d",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "5px 8px",
  cursor: "pointer",
};
