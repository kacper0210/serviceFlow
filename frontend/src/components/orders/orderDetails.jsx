import { useEffect, useState } from "react";
import { btnCancel } from "./ordersStyles";

export default function OrderDetails({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [client, setClient] = useState(null);

  useEffect(() => {
    if (!orderId) return;

    fetch(`http://localhost:4000/api/orders/${orderId}`)
      .then((res) => res.json())
      .then((data) => {
        setOrder(data);
        if (data.client_id) {
          fetch(`http://localhost:4000/api/clients/${data.client_id}`)
            .then((res) => res.json())
            .then((clientData) => setClient(clientData));
        }
      })
      .catch(console.error);
  }, [orderId]);

  if (!order) return null;

  return (
    <div style={modalOverlay}>
      <div style={modalBox}>
        <h2>{order.title}</h2>
        <p>
          <b>Status:</b> {order.status} <br />
          <b>Cena:</b> {order.price ? `${order.price} zł` : "—"} <br />
          <b>Termin:</b> {order.deadline ? order.deadline.split("T")[0] : "—"}
        </p>

        <p>{order.description || "Brak opisu"}</p>

        {client && (
          <>
            <hr />
            <h3>Klient:</h3>
            <p>
              {client.first_name} {client.last_name} <br />
              {client.phone && <>📞 {client.phone}<br /></>}
              {client.email && <>✉️ {client.email}</>}
            </p>
          </>
        )}

        <button onClick={onClose} style={btnCancel}>
          Zamknij
        </button>
      </div>
    </div>
  );
}

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
  maxWidth: "600px",
  width: "90%",
  maxHeight: "80vh",
  overflowY: "auto",
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
};
