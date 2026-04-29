import { useEffect, useState } from "react";
import "./clients.css";

export default function ClientDetails({ clientId, onClose }) {
  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!clientId) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const authStorage = localStorage.getItem("auth");
        const token = authStorage ? JSON.parse(authStorage).token : null;

        const headers = {
          "Authorization": `Bearer ${token}`
        };

        const clientRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients/${clientId}`, { headers });

        if (!clientRes.ok) {
          throw new Error("Nie znaleziono klienta");
        }
        const clientData = await clientRes.json();

        const ordersRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders?client=${clientId}`, { headers });
        let ordersData = [];
        if (ordersRes.ok) {
          ordersData = await ordersRes.json();
        }

        setClient(clientData);
        setOrders(ordersData);

      } catch (err) {
        console.error("Błąd pobierania szczegółów:", err);
        setError("Nie udało się załadować danych.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

  }, [clientId]);

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <p>Ładowanie danych...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <p style={{ color: "red" }}>{error}</p>
          <button onClick={onClose}>Zamknij</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Szczegóły klienta</h3>
          <button onClick={onClose} className="close-btn">✕</button>
        </div>

        {client && (
          <div className="details-container">
            <div className="detail-row">
              <span className="label">Imię i nazwisko:</span>
              <span className="value">{client.first_name} {client.last_name}</span>
            </div>

            <div className="detail-row">
              <span className="label">Telefon:</span>
              <span className="value">{client.phone}</span>
            </div>

            <div className="detail-row">
              <span className="label">Email:</span>
              <span className="value">{client.email || "brak"}</span>
            </div>

            <div className="detail-row">
              <span className="label">Adres:</span>
              <span className="value">{client.address || "brak"}</span>
            </div>

            {client.type === "firma" && (
              <div className="company-section">
                <hr />
                <h4>Dane firmy</h4>
                <div className="detail-row">
                  <span className="label">Nazwa firmy:</span>
                  <span className="value">{client.company_name}</span>
                </div>
                <div className="detail-row">
                  <span className="label">NIP:</span>
                  <span className="value">{client.nip}</span>
                </div>
              </div>
            )}

            <hr />

            <div className="orders-section">
              <h4>Ostatnie zlecenia</h4>

              <div className="orders-list">
                {orders.length === 0 ? (
                  <p className="no-data">Brak zleceń w historii.</p>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="order-item">
                      <span className="order-title">{order.title}</span>
                      <span className={`status-badge status-${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        <div className="modal-footer">
          <button onClick={onClose} className="btn-close">Zamknij</button>
        </div>
      </div>
    </div>
  );
}