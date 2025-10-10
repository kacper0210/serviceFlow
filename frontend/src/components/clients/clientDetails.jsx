import { useEffect, useState } from "react";
import { btnCancel } from "./clientsStyles";

export default function ClientDetails({ clientId, onClose }) {
  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!clientId) return;

    // Pobierz szczegóły klienta
    fetch(`http://localhost:4000/api/clients/${clientId}`)
      .then((res) => res.json())
      .then((data) => setClient(data))
      .catch(console.error);

    // Pobierz jego zlecenia
    fetch(`http://localhost:4000/api/orders?client=${clientId}`)
      .then((res) => res.json())
      .then((data) => setOrders(data))
      .catch(console.error);
  }, [clientId]);

  if (!client) return null;

  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2>
          {client.first_name} {client.last_name}
        </h2>
        <p>
          📧 {client.email || "brak e-maila"} <br />
          📞 {client.phone || "brak telefonu"} <br />
          🏠 {client.address || "brak adresu"}
        </p>

        {client.company_name && (
          <p>
            🏢 {client.company_name}
            {client.nip && <><br />NIP: {client.nip}</>}
          </p>
        )}

        <hr />
        <h3>Zlecenia klienta:</h3>
        {orders.length > 0 ? (
          <ul>
            {orders.map((o) => (
              <li key={o.id}>
                <b>{o.title}</b> – {o.status}
              </li>
            ))}
          </ul>
        ) : (
          <p>Brak zleceń.</p>
        )}

        <button onClick={onClose} style={btnCancel}>
          Zamknij
        </button>
      </div>
    </div>
  );
}

// 🌙 Prosty styl modala
const modalOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000,
};

const modalBox = {
  background: "#fff",
  color: "#222",
  borderRadius: "10px",
  padding: "20px 30px",
  maxWidth: "500px",
  width: "90%",
  maxHeight: "80vh",
  overflowY: "auto",
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
};
