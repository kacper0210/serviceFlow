import { useEffect, useState } from "react";
import "./orders.css"

export default function OrderDetails({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const authData = JSON.parse(localStorage.getItem("auth"));
        const token = authData?.token;
        const headers = { "Authorization": `Bearer ${token}` };

        const orderRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders/${orderId}`, { headers });
        const orderData = await orderRes.json();
        setOrder(orderData);

        if (orderData.client_id) {
          const clientRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients/${orderData.client_id}`, { headers });
          const clientData = await clientRes.json();
          setClient(clientData);
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId]);

  const [costs, setCosts] = useState([]);
  const [costAmount, setCostAmount] = useState("");
  const [costTitle, setCostTitle] = useState("");

  const fetchCosts = async () => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const token = authData?.token;
      const headers = { "Authorization": `Bearer ${token}` };
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders/${orderId}/costs`, { headers });
      const data = await res.json();
      setCosts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (orderId) fetchCosts();
  }, [orderId]);

  const handleAddCost = async (e) => {
    e.preventDefault();
    if (!costAmount) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const token = authData?.token;
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders/${orderId}/costs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ amount: parseFloat(costAmount), title: costTitle })
      });

      if (res.ok) {
        const updatedOrder = await res.json();
        setOrder(updatedOrder);
        setCostAmount("");
        setCostTitle("");
        fetchCosts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="modal-content">Ładowanie...</div>;
  if (!order) return <div className="modal-content">Nie znaleziono zlecenia.</div>;

  const profit = (parseFloat(order.price) || 0) - (parseFloat(order.total_costs) || 0);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 700 }}>
        <button className="close-btn" onClick={onClose}>✕</button>

        <h3 style={{ marginTop: 0 }}>Zlecenie #{order.id}</h3>

        <div style={{ display: 'flex', gap: '10px', marginBottom: 20 }}>
          <span className={`status-badge status-${order.status}`}>
            {order.status.replace("_", " ")}
          </span>
          <span className="badge badge-success" style={{ padding: '8px 16px', borderRadius: '10px' }}>
            Zysk: {profit} PLN
          </span>
        </div>

        <div className="form-group">
          <label>Tytuł:</label>
          <div style={{ fontSize: "1.1em", fontWeight: "bold" }}>{order.title}</div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Cena dla klienta (Przychód):</label>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                {order.price ? `${order.price} PLN` : "—"}
            </div>
          </div>
          <div className="form-group">
            <label>Suma kosztów:</label>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--danger-color)' }}>
                {order.total_costs ? `${order.total_costs} PLN` : "0 PLN"}
            </div>
          </div>
        </div>

        <section style={{ background: 'var(--bg-gray)', padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 16px 0' }}>Koszty wykonania</h4>
            
            <form onSubmit={handleAddCost} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                <input 
                    className="form-input" 
                    placeholder="Kwota (zł)" 
                    type="number" 
                    value={costAmount}
                    onChange={e => setCostAmount(e.target.value)}
                    style={{ flex: 1 }}
                />
                <input 
                    className="form-input" 
                    placeholder="Opis kosztu" 
                    value={costTitle}
                    onChange={e => setCostTitle(e.target.value)}
                    style={{ flex: 2 }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }}>Dodaj</button>
            </form>

            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {costs.length > 0 ? (
                    <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                        <tbody>
                            {costs.map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '8px 0' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                                    <td style={{ padding: '8px 0' }}>{c.title || "Koszt"}</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700 }}>-{c.amount} zł</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Brak wpisanych kosztów.</p>
                )}
            </div>
        </section>

        <div className="form-group">
          <label>Opis / Usterka:</label>
          <div style={{ background: "var(--bg-app)", padding: 16, borderRadius: 12, minHeight: 60 }}>
            {order.description || "Brak opisu"}
          </div>
        </div>

        {client && (
          <div style={{ marginTop: 20, borderTop: "1px solid var(--border-color)", paddingTop: 20 }}>
            <h4 style={{ marginBottom: 12 }}>Dane klienta</h4>
            <div>
              <strong>{client.first_name} {client.last_name}</strong>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: 4 }}>
              {client.company_name && <span>{client.company_name} | </span>}
              {client.email} | {client.phone}
            </div>
          </div>
        )}

        <div style={{ marginTop: 32, textAlign: "right" }}>
          <button onClick={onClose} className="btn btn-secondary">Zamknij</button>
        </div>
      </div>
    </div>
  );
}