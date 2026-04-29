import { useEffect, useState } from "react";

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState({
    status: "",
    sort: "",
    search: "",
  });

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (filter.status) params.append("status", filter.status);
      if (filter.sort) params.append("sort", filter.sort);
      if (filter.search) params.append("search", filter.search);

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders?${params.toString()}`);
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error("Błąd pobierania zleceń:", err);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`);
      const data = await res.json();
      setClients(data);
    } catch (err) {
      console.error("Błąd pobierania klientów:", err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchClients();
  }, [filter]);

  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć to zlecenie?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== id));
        alert("Zlecenie zostało usunięte.");
      } else {
        alert(data.error || "Nie udało się usunąć zlecenia.");
      }
    } catch (err) {
      console.error(err);
      alert("Błąd połączenia z serwerem.");
    }
  };

  const handleEdit = (order) => {
    setEditingOrder(order.id);
    setEditForm({ ...order });
  };

  const handleChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleSave = async (id) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (res.ok) {
        setEditingOrder(null);
        fetchOrders();
        alert("Zlecenie zaktualizowane.");
      } else {
        alert(data.error || "Nie udało się zaktualizować zlecenia.");
      }
    } catch (err) {
      console.error("Błąd edycji:", err);
    }
  };

  const handleFilterChange = (e) => {
    setFilter({ ...filter, [e.target.name]: e.target.value });
  };

  return (
    <div>
      <h3>Lista zleceń</h3>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <select
          name="status"
          value={filter.status}
          onChange={handleFilterChange}
          style={inputStyle}
        >
          <option value="">Wszystkie statusy</option>
          <option value="nowe">Nowe</option>
          <option value="w_trakcie">W trakcie</option>
          <option value="zakończone">Zakończone</option>
        </select>

        <select name="sort" value={filter.sort} onChange={handleFilterChange} style={inputStyle}>
          <option value="">Sortowanie: domyślne</option>
          <option value="title_asc">Tytuł A–Z</option>
          <option value="title_desc">Tytuł Z–A</option>
          <option value="deadline_asc">Termin rosnąco</option>
          <option value="deadline_desc">Termin malejąco</option>
        </select>

        <input
          type="text"
          name="search"
          value={filter.search}
          onChange={handleFilterChange}
          placeholder="🔍 Szukaj zlecenia..."
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {orders.map((order) => (
          <li
            key={order.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "8px",
              background: "#fff",
              marginBottom: "15px",
              padding: "10px",
              color: "#222",
            }}
          >
            {editingOrder === order.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave(order.id);
                }}
                style={{ display: "grid", gap: "8px" }}
              >
                <input
                  name="title"
                  value={editForm.title}
                  onChange={handleChange}
                  placeholder="Tytuł"
                  style={inputStyle}
                />

                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleChange}
                  placeholder="Opis"
                  style={inputStyle}
                />

                <select
                  name="status"
                  value={editForm.status}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="nowe">Nowe</option>
                  <option value="w_trakcie">W trakcie</option>
                  <option value="zakończone">Zakończone</option>
                </select>

                <input
                  name="price"
                  value={editForm.price || ""}
                  onChange={handleChange}
                  placeholder="Cena (zł)"
                  style={inputStyle}
                />

                <input
                  type="datetime-local"
                  name="deadline"
                  value={editForm.deadline ? editForm.deadline.slice(0, 16) : ""}
                  onChange={handleChange}
                  style={inputStyle}
                />

                <textarea
                  name="notes"
                  value={editForm.notes || ""}
                  onChange={handleChange}
                  placeholder="Notatki"
                  style={inputStyle}
                />

                <select
                  name="client_id"
                  value={editForm.client_id}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">-- Wybierz klienta --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} {c.company_name ? `(${c.company_name})` : ""}
                    </option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="submit" style={btnSave}>
                    💾 Zapisz
                  </button>
                  <button type="button" onClick={() => setEditingOrder(null)} style={btnCancel}>
                    ✖ Anuluj
                  </button>
                </div>
              </form>
            ) : (
              <>
                <b>{order.title}</b> – {order.status}
                <br />
                <small>
                  Klient: {order.first_name} {order.last_name}{" "}
                  {order.phone
                    ? `(📞 ${order.phone})`
                    : order.email
                      ? `(✉️ ${order.email})`
                      : "(brak danych kontaktowych)"}
                </small>
                <br />
                {order.description}
                <div style={{ marginTop: "8px" }}>
                  <button onClick={() => handleEdit(order)} style={btnEdit}>
                    ✏️ Edytuj
                  </button>
                  <button onClick={() => handleDelete(order.id)} style={btnDelete}>
                    🗑️ Usuń
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const inputStyle = {
  padding: "8px",
  border: "1px solid #ccc",
  borderRadius: "6px",
  width: "auto",
  minWidth: "150px",
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
