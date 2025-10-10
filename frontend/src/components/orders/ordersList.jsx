import { useEffect, useState } from "react";
import OrderItem from "./orderItem";
import { fetchOrdersFromApi, fetchClientsFromApi } from "./utils";
import { inputStyle } from "./ordersStyles";

export default function OrdersList({ refreshTrigger }) {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [filter, setFilter] = useState({
    status: "",
    sort: "",
    search: "",
    client: "",
    deadline: "",
  });

  /** 🔄 Pobieranie zleceń */
  const fetchOrders = async () => {
    const data = await fetchOrdersFromApi(filter);
    if (data) setOrders(data);
  };

  /** 👥 Pobieranie klientów */
  const fetchClients = async () => {
    const data = await fetchClientsFromApi();
    if (data) setClients(data);
  };

  /** ⏱️ Przy starcie + zmiana filtrów lub odświeżenie */
  useEffect(() => {
    fetchOrders();
    fetchClients();
  }, [filter, refreshTrigger]);

  /** 🧠 Zmiana filtrów */
  const handleFilterChange = (e) => {
    setFilter({ ...filter, [e.target.name]: e.target.value });
  };

  /** 🗑️ Usuwanie zlecenia */
  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć to zlecenie?")) return;

    try {
      const res = await fetch(`http://localhost:4000/api/orders/${id}`, {
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

  /** 🎨 Kolor statusu */
  const getStatusColor = (status) => {
    switch (status) {
      case "nowe":
        return "#28a745"; // zielony
      case "w_trakcie":
        return "#ffc107"; // żółty
      case "zakończone":
        return "#6c757d"; // szary
      default:
        return "#007bff"; // domyślny niebieski
    }
  };

  return (
    <div>
      <h3>Lista zleceń</h3>

      {/* 🔧 Panel filtrów */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        {/* Status */}
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

        {/* Klient */}
        <select
          name="client"
          value={filter.client}
          onChange={handleFilterChange}
          style={inputStyle}
        >
          <option value="">Wszyscy klienci</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.first_name} {c.last_name}{" "}
              {c.company_name ? `(${c.company_name})` : ""}
            </option>
          ))}
        </select>

        {/* Termin */}
        <input
          type="date"
          name="deadline"
          value={filter.deadline}
          onChange={handleFilterChange}
          style={inputStyle}
        />

        {/* Sortowanie */}
        <select
          name="sort"
          value={filter.sort}
          onChange={handleFilterChange}
          style={inputStyle}
        >
          <option value="">Sortowanie: domyślne</option>
          <option value="price_asc">Cena rosnąco</option>
          <option value="price_desc">Cena malejąco</option>
          <option value="deadline_asc">Termin rosnąco</option>
          <option value="deadline_desc">Termin malejąco</option>
          <option value="title_asc">Tytuł A–Z</option>
          <option value="title_desc">Tytuł Z–A</option>
        </select>

        {/* Wyszukiwanie */}
        <input
          type="text"
          name="search"
          value={filter.search}
          onChange={handleFilterChange}
          placeholder="🔍 Szukaj zlecenia..."
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>

      {/* 📋 Lista zleceń */}
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
              boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                borderLeft: `6px solid ${getStatusColor(order.status)}`,
                paddingLeft: "10px",
              }}
            >
              <OrderItem
                order={order}
                clients={clients}
                isEditing={editingOrder === order.id}
                onEdit={() => setEditingOrder(order.id)}
                onCancelEdit={() => setEditingOrder(null)}
                onDelete={() => handleDelete(order.id)}
                onSaved={fetchOrders}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
