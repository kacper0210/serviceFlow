import { useEffect, useState } from "react";
import "./orders.css";

export default function OrderDetails({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  const [costs, setCosts] = useState([]);
  const [costAmount, setCostAmount] = useState("");
  const [costTitle, setCostTitle] = useState("");

  const [editingCostId, setEditingCostId] = useState(null);
  const [editCostAmount, setEditCostAmount] = useState("");
  const [editCostTitle, setEditCostTitle] = useState("");

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

  const fetchCosts = async () => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const token = authData?.token;
      const headers = { "Authorization": `Bearer ${token}` };
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders/${orderId}/costs`, { headers });
      const data = await res.json();
      setCosts(Array.isArray(data) ? data : []);
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

  const startEditCost = (cost) => {
    setEditingCostId(cost.id);
    setEditCostAmount(cost.amount);
    setEditCostTitle(cost.title || "");
  };

  const handleSaveCost = async (costId) => {
    if (!editCostAmount) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const token = authData?.token;
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders/${orderId}/costs/${costId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ amount: parseFloat(editCostAmount), title: editCostTitle })
      });

      if (res.ok) {
        const updatedOrder = await res.json();
        setOrder(updatedOrder);
        setEditingCostId(null);
        fetchCosts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCost = async (costId) => {
    if (!window.confirm("Czy na pewno chcesz usunąć ten koszt?")) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const token = authData?.token;
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders/${orderId}/costs/${costId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.ok) {
        const updatedOrder = await res.json();
        setOrder(updatedOrder);
        fetchCosts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="modal-content modal-order-details"><p style={{ padding: 20 }}>Ładowanie...</p></div>;
  if (!order) return <div className="modal-content modal-order-details"><p style={{ padding: 20 }}>Nie znaleziono zlecenia.</p></div>;

  const getStatusBadge = (status) => {
    if (!status) return { label: "-", className: "" };
    const st = status.toLowerCase();
    if (st === "completed" || st === "zakonczone" || st === "zakończone") {
      return { label: "Zakończone", className: "status-zakonczone" };
    }
    if (st === "in_progress" || st === "w_trakcie" || st === "w realizacji") {
      return { label: "W realizacji", className: "status-w_trakcie" };
    }
    if (st === "new" || st === "nowe") {
      return { label: "Nowe", className: "status-nowe" };
    }
    if (st === "on_hold" || st === "wstrzymane") {
      return { label: "Wstrzymane", className: "status-wstrzymane" };
    }
    return { label: status, className: `status-${st}` };
  };

  const statusInfo = getStatusBadge(order.status);
  const profit = (parseFloat(order.price) || 0) - (parseFloat(order.total_costs) || 0);
  const clientName = client ? (client.company_name || `${client.first_name || ''} ${client.last_name || ''}`.trim()) : "Brak przypisanego klienta";

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-order-details">
        <button className="close-btn" onClick={onClose}>✕</button>

        {/* Modal Header */}
        <div className="order-details-header">
          <h3 className="order-details-title">
            Zlecenie #{order.id}: <span style={{ color: 'var(--primary-color)' }}>{order.title}</span>
          </h3>

          <div className="order-details-badges">
            <span className={`status-badge ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
            <span className="badge badge-success" style={{ padding: '6px 14px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
              Zysk: {profit.toFixed(2)} zł
            </span>
          </div>
        </div>

        {/* 3-Column Metrics Grid */}
        <div className="order-metrics-grid">
          <div className="metric-card">
            <span className="metric-label">Przychód (Cena)</span>
            <span className="metric-value" style={{ color: 'var(--primary-color)' }}>
              {order.price ? `${Number(order.price).toFixed(2)} zł` : "0.00 zł"}
            </span>
          </div>

          <div className="metric-card">
            <span className="metric-label">Suma Kosztów</span>
            <span className="metric-value" style={{ color: 'var(--danger-color)' }}>
              {order.total_costs ? `${Number(order.total_costs).toFixed(2)} zł` : "0.00 zł"}
            </span>
          </div>

          <div className="metric-card metric-card-full">
            <span className="metric-label">Klient</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', wordBreak: 'break-word' }}>
                {clientName}
              </span>
              {client?.phone && (
                <a 
                  href={`tel:${client.phone.replace(/\s+/g, '')}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    textDecoration: 'none',
                    boxShadow: '0 2px 6px rgba(34, 197, 94, 0.3)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  title="Kliknij, aby zadzwonić do klienta"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span style={{ whiteSpace: 'nowrap' }}>Zadzwoń ({client.phone})</span>
                </a>
              )}
            </div>
            {client?.email && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-word', marginTop: '4px', display: 'block' }}>
                ✉️ {client.email}
              </span>
            )}
          </div>
        </div>

        {/* Costs Management Box */}
        <div className="order-costs-section">
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
            💰 Koszty wykonania zlecenia
          </h4>

          {/* Add Cost Form */}
          <form onSubmit={handleAddCost} className="cost-form">
            <input 
              className="form-input cost-form-input-kwota" 
              placeholder="Kwota (zł)" 
              type="number" 
              step="0.01"
              value={costAmount}
              onChange={e => setCostAmount(e.target.value)}
            />
            <input 
              className="form-input cost-form-input-opis" 
              placeholder="Opis kosztu (np. Zakup części, paliwo...)" 
              value={costTitle}
              onChange={e => setCostTitle(e.target.value)}
            />
            <button type="submit" className="btn btn-primary cost-form-submit-btn">
              + Dodaj koszt
            </button>
          </form>

          {/* Cost Items List */}
          <div className="cost-items-wrapper">
            {costs.length > 0 ? (
              costs.map(c => {
                const isEditing = editingCostId === c.id;
                return (
                  <div key={c.id} className="cost-item-row">
                    {isEditing ? (
                      <div className="cost-edit-form-row">
                        <input 
                          className="form-input" 
                          value={editCostTitle} 
                          onChange={e => setEditCostTitle(e.target.value)}
                          placeholder="Opis kosztu"
                          style={{ flex: 1, minWidth: '120px', padding: '6px 10px', fontSize: '0.85rem' }}
                        />
                        <input 
                          className="form-input" 
                          type="number" 
                          step="0.01"
                          value={editCostAmount} 
                          onChange={e => setEditCostAmount(e.target.value)}
                          placeholder="Kwota zł"
                          style={{ width: '100px', padding: '6px 10px', fontSize: '0.85rem' }}
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn-table" style={{ background: 'var(--success)', color: '#fff' }} onClick={() => handleSaveCost(c.id)}>Zapisz</button>
                          <button className="btn-table" onClick={() => setEditingCostId(null)}>Anuluj</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="cost-item-info">
                          <span className="cost-item-date">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                          <span className="cost-item-title">
                            {c.title || "Koszt bez nazwy"}
                          </span>
                        </div>

                        <div className="cost-item-actions-row">
                          <span className="cost-item-amount">
                            -{Number(c.amount).toFixed(2)} zł
                          </span>

                          <div className="cost-item-btns">
                            <button 
                              className="btn-cost-action btn-cost-edit" 
                              title="Edytuj koszt"
                              onClick={() => startEditCost(c)}
                            >
                              ✏️ Edytuj
                            </button>
                            <button 
                              className="btn-cost-action btn-cost-delete" 
                              title="Usuń koszt"
                              onClick={() => handleDeleteCost(c.id)}
                            >
                              🗑️ Usuń
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', margin: '16px 0' }}>
                Brak wpisanych kosztów dla tego zlecenia.
              </p>
            )}
          </div>
        </div>

        {/* Description Section */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
            Opis / Usterka:
          </label>
          <div style={{ background: "var(--bg-gray)", padding: '12px 16px', borderRadius: 10, fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.4 }}>
            {order.description || "Brak opisu zlecenia"}
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ textAlign: "right", marginTop: 'auto', paddingTop: 10 }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 24px', fontSize: '0.9rem' }}>
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}