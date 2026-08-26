import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import AddOrderForm from "./addOrderForm";
import EditOrderForm from "./editOrderForm";
import OrderDetails from "./orderDetails";

const STATUS_OPTIONS = [
  { key: 'nowe', label: 'Nowe', color: '#3b82f6', badgeBg: 'rgba(59, 130, 246, 0.15)' },
  { key: 'w_trakcie', label: 'W realizacji', color: '#f59e0b', badgeBg: 'rgba(245, 158, 11, 0.15)' },
  { key: 'zakonczone', label: 'Zakończone', color: '#10b981', badgeBg: 'rgba(16, 185, 129, 0.15)' },
  { key: 'wstrzymane', label: 'Wstrzymane', color: '#ef4444', badgeBg: 'rgba(239, 68, 68, 0.15)' }
];

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

const SortIcon = ({ active, direction }) => {
  if (!active) return <span style={{ opacity: 0.25, marginLeft: 4, fontSize: '0.75rem' }}>↕</span>;
  return <span style={{ color: "var(--primary-color)", marginLeft: 4, fontWeight: "bold", fontSize: '0.8rem' }}>{direction === 'asc' ? '▲' : '▼'}</span>;
};

export default function OrdersList() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("list");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get("status");
    if (statusParam) {
      const parsed = statusParam.split(',').map(s => s.trim()).filter(Boolean);
      setSelectedStatuses(parsed);
    }
  }, [location.search]);

  const toggleStatusFilter = useCallback((statusKey) => {
    setSelectedStatuses(prev => {
      if (prev.includes(statusKey)) {
        return prev.filter(k => k !== statusKey);
      } else {
        return [...prev, statusKey];
      }
    });
    setCurrentPage(1);
  }, []);

  const clearStatusFilter = useCallback(() => {
    setSelectedStatuses([]);
    setCurrentPage(1);
  }, []);

  const getClientDisplayName = useCallback((order) => {
    if (order.company_name) return order.company_name;
    if (order.first_name || order.last_name) return `${order.first_name || ''} ${order.last_name || ''}`.trim();
    if (order.client_id) {
      const c = clients.find(item => item.id === order.client_id);
      if (c) {
        if (c.company_name) return c.company_name;
        const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim();
        if (fullName) return fullName;
      }
    }
    return "👤 Brak klienta";
  }, [clients]);

  const [sortField, setSortField] = useState("id");
  const [sortDirection, setSortDirection] = useState("desc");

  const handleSort = useCallback((field) => {
    setSortField(prevField => {
      if (prevField === field) {
        setSortDirection(prevDir => (prevDir === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortDirection('asc');
      return field;
    });
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (selectedStatuses.length > 0) {
        const st = (order.status || "").toLowerCase();
        const matchesAny = selectedStatuses.some(statusKey => {
          if (statusKey === "zakonczone" && (st === "completed" || st.includes("zako"))) return true;
          if (statusKey === "w_trakcie" && (st === "in_progress" || st.includes("trakcie"))) return true;
          if (statusKey === "nowe" && (st === "new" || st.includes("now"))) return true;
          if (statusKey === "wstrzymane" && (st === "on_hold" || st.includes("wstrzyma"))) return true;
          return false;
        });
        if (!matchesAny) return false;
      }

      if (filterMonth) {
        const dateStr = order.deadline || order.created_at;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        const orderMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (orderMonthKey !== filterMonth) return false;
      }

      const search = searchText.toLowerCase();
      const titleMatch = order.title?.toLowerCase().includes(search);
      const clientName = getClientDisplayName(order).toLowerCase();
      const clientMatch = clientName.includes(search);

      return !searchText || titleMatch || clientMatch;
    });
  }, [orders, selectedStatuses, filterMonth, searchText, getClientDisplayName]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case 'id':
          aVal = Number(a.id);
          bVal = Number(b.id);
          break;
        case 'title':
          aVal = (a.title || "").toLowerCase();
          bVal = (b.title || "").toLowerCase();
          break;
        case 'client':
          aVal = getClientDisplayName(a).toLowerCase();
          bVal = getClientDisplayName(b).toLowerCase();
          break;
        case 'deadline':
          aVal = a.deadline ? new Date(a.deadline).getTime() : 0;
          bVal = b.deadline ? new Date(b.deadline).getTime() : 0;
          break;
        case 'price':
          aVal = Number(a.price) || 0;
          bVal = Number(b.price) || 0;
          break;
        case 'status':
          aVal = (getStatusBadge(a.status).label || "").toLowerCase();
          bVal = (getStatusBadge(b.status).label || "").toLowerCase();
          break;
        default:
          aVal = Number(a.id);
          bVal = Number(b.id);
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredOrders, sortField, sortDirection, getClientDisplayName]);

  return (
    <div className="orders-container">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px' }}>
        <button 
          className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary-outline'}`} 
          onClick={() => setActiveTab('list')}
        >
          📝 Lista Zleceń
        </button>
        <button 
          className={`btn ${activeTab === 'profits' ? 'btn-primary' : 'btn-secondary-outline'}`} 
          onClick={() => setActiveTab('profits')}
        >
          📈 Dochody z palca na wykres
        </button>
      </div>

      {activeTab === 'profits' && <ManualProfitsView />}

      {activeTab === 'list' && (
        <>
          {/* Express 1-Click Quick Add Order Bar */}
          <form onSubmit={handleQuickAddOrder} style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '16px',
            background: 'var(--bg-card)',
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1.5px dashed var(--primary-color)',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary-color)' }}>
              ⚡ Szybkie zlecenie:
            </div>
            <input
              className="form-input"
              placeholder="Wpisz tylko tytuł zlecenia i kliknij Enter (np. Naprawa telefonu, Diagnoza)..."
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              style={{ flex: 1, minWidth: '200px', height: '40px', fontSize: '0.88rem', borderRadius: '8px' }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={quickLoading || !quickTitle.trim()}
              style={{ height: '40px', padding: '0 20px', fontWeight: 600, whiteSpace: 'nowrap', borderRadius: '8px' }}
            >
              {quickLoading ? "Dodawanie..." : "+ Dodaj błyskawicznie"}
            </button>
          </form>

          <div className="toolbar">
        <div className="search-box">
          <input
            className="filter-input filter-input-search"
            placeholder="Szukaj (tytuł, klient)..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          <select
            className="filter-input filter-input-month"
            value={filterMonth}
            onChange={e => {
              setFilterMonth(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">Wszystkie miesiące</option>
            {availableMonths.map(m => (
              <option key={m.key} value={m.key}>
                📅 {m.label}
              </option>
            ))}
          </select>
          {/* Multi-Select Status Dropdown Component */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              className="filter-input filter-input-status-multi"
              onClick={() => setShowStatusDropdown(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                minWidth: '160px',
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: selectedStatuses.length > 0 ? 'var(--primary-light)' : 'var(--input-bg)',
                borderColor: selectedStatuses.length > 0 ? 'var(--primary-color)' : 'var(--border-color)',
                color: selectedStatuses.length > 0 ? 'var(--primary-color)' : 'var(--input-text)',
                fontWeight: selectedStatuses.length > 0 ? 600 : 400
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedStatuses.length === 0 && "🏷️ Wszystkie statusy"}
                {selectedStatuses.length === 1 && `🏷️ ${STATUS_OPTIONS.find(o => o.key === selectedStatuses[0])?.label || selectedStatuses[0]}`}
                {selectedStatuses.length > 1 && `🏷️ Wybrano (${selectedStatuses.length})`}
              </span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{showStatusDropdown ? '▲' : '▼'}</span>
            </button>

            {showStatusDropdown && (
              <>
                <div 
                  onClick={() => setShowStatusDropdown(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  width: '210px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                  padding: '12px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    <span>Filtruj wg statusu</span>
                    {selectedStatuses.length > 0 && (
                      <button
                        type="button"
                        onClick={clearStatusFilter}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0 }}
                      >
                        Wyczyść
                      </button>
                    )}
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', padding: '4px 6px', borderRadius: '6px' }}>
                    <input
                      type="checkbox"
                      checked={selectedStatuses.length === 0}
                      onChange={clearStatusFilter}
                    />
                    <span>Wszystkie statusy</span>
                  </label>

                  {STATUS_OPTIONS.map(opt => {
                    const isChecked = selectedStatuses.includes(opt.key);
                    return (
                      <label 
                        key={opt.key}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          cursor: 'pointer', 
                          fontSize: '0.88rem', 
                          padding: '6px 8px', 
                          borderRadius: '6px',
                          background: isChecked ? opt.badgeBg : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStatusFilter(opt.key)}
                        />
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.color }} />
                        <span style={{ fontWeight: isChecked ? 600 : 400 }}>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <select
            className="filter-input filter-input-sort"
            value={`${sortField}_${sortDirection}`}
            onChange={e => {
              const [field, dir] = e.target.value.split('_');
              setSortField(field);
              setSortDirection(dir);
            }}
          >
            <option value="id_desc">Sortuj: Najnowsze (ID ↓)</option>
            <option value="id_asc">Sortuj: Najstarsze (ID ↑)</option>
            <option value="deadline_asc">Sortuj: Termin (najbliższy)</option>
            <option value="deadline_desc">Sortuj: Termin (najdalszy)</option>
            <option value="price_desc">Sortuj: Cena (najwyższa)</option>
            <option value="price_asc">Sortuj: Cena (najniższa)</option>
            <option value="title_asc">Sortuj: Tytuł (A-Z)</option>
            <option value="client_asc">Sortuj: Klient (A-Z)</option>
          </select>
        </div>

        <div className="actions-box">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Dodaj zlecenie
          </button>
        </div>

      </div>

      {/* Active Multi-Status Filter Badges / Chips */}
      {selectedStatuses.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '16px', marginTop: '-10px', padding: '0 4px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Aktywne statusy:</span>
          {selectedStatuses.map(statusKey => {
            const opt = STATUS_OPTIONS.find(o => o.key === statusKey);
            return (
              <button
                key={statusKey}
                type="button"
                onClick={() => toggleStatusFilter(statusKey)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: opt?.badgeBg || 'var(--primary-light)',
                  border: '1px solid var(--border-color)',
                  color: opt?.color || 'var(--primary-color)',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: opt?.color }} />
                <span>{opt?.label || statusKey}</span>
                <span style={{ opacity: 0.7, marginLeft: '2px', fontWeight: 700 }}>✕</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={clearStatusFilter}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', padding: '2px 6px', fontWeight: 500 }}
          >
            Wyczyść wszystkie
          </button>
        </div>
      )}

      <div className="table-container">
        {loading ? (
          <p style={{ padding: 20 }}>Ładowanie...</p>
        ) : (
          <>
            <table className="orders-table">
              <thead>
                <tr>
                  <th style={{ width: "6%", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("id")}>
                    ID <SortIcon active={sortField === "id"} direction={sortDirection} />
                  </th>
                  <th style={{ width: "25%", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("title")}>
                    Tytuł <SortIcon active={sortField === "title"} direction={sortDirection} />
                  </th>
                  <th style={{ width: "23%", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("client")}>
                    Klient <SortIcon active={sortField === "client"} direction={sortDirection} />
                  </th>
                  <th style={{ width: "13%", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("deadline")}>
                    Termin <SortIcon active={sortField === "deadline"} direction={sortDirection} />
                  </th>
                  <th style={{ width: "13%", textAlign: "right", paddingRight: "20px", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("price")}>
                    Cena <SortIcon active={sortField === "price"} direction={sortDirection} />
                  </th>
                  <th style={{ width: "12%", textAlign: "center", cursor: "pointer", userSelect: "none" }} onClick={() => handleSort("status")}>
                    Status <SortIcon active={sortField === "status"} direction={sortDirection} />
                  </th>
                  <th style={{ width: "8%", textAlign: "right", paddingRight: "20px" }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(order => {
                  const clientName = getClientDisplayName(order);
                  const statusInfo = getStatusBadge(order.status);
                  return (
                    <tr key={order.id}>
                      <td data-label="ID">#{order.id}</td>
                      <td data-label="Tytuł"><strong>{order.title}</strong></td>
                      <td data-label="Klient">
                        <strong>{clientName}</strong>
                      </td>
                      <td data-label="Termin" style={{ whiteSpace: "nowrap" }}>
                        {order.deadline ? new Date(order.deadline).toLocaleDateString() : "-"}
                      </td>
                      <td data-label="Cena" className="text-right" style={{ whiteSpace: "nowrap", fontWeight: 600, textAlign: "right", paddingRight: "20px" }}>
                        {order.price ? `${Number(order.price).toFixed(2)} zł` : "-"}
                      </td>
                      <td data-label="Status" style={{ textAlign: "center" }}>
                        <span className={`status-badge ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td data-label="Akcje" style={{ textAlign: "right", paddingRight: "20px" }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          <button className="btn-table" onClick={() => setDetailsId(order.id)}>Podgląd</button>
                          <button className="btn-table" onClick={() => setEditOrder(order)}>Edytuj</button>
                          <button className="btn-table btn-delete" onClick={() => handleDelete(order.id)}>Usuń</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: "center", padding: 20 }}>Brak wyników</td></tr>
                )}
              </tbody>
            </table>

            {filteredOrders.length > itemsPerPage && (
              <div className="pagination-row">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  &lt; Poprzednia
                </button>
                <span>Strona {currentPage} z {Math.ceil(filteredOrders.length / itemsPerPage)}</span>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredOrders.length / itemsPerPage), p + 1))}
                  disabled={currentPage === Math.ceil(filteredOrders.length / itemsPerPage)}
                >
                  Następna &gt;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            <h3 style={{ marginTop: 0, textAlign: "center" }}>Nowe zlecenie</h3>
            <AddOrderForm onOrderAdded={(newOrder) => {
              setOrders(prev => [newOrder, ...prev]);
              fetchData();
              setShowAddModal(false);
            }} />
          </div>
        </div>
      )}

      {editOrder && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setEditOrder(null)}>✕</button>
            <EditOrderForm
              order={editOrder}
              clients={clients}
              onCancel={() => setEditOrder(null)}
              onSaved={() => {
                fetchData();
                setEditOrder(null);
              }}
            />
          </div>
        </div>
      )}

      {detailsId && (
        <OrderDetails orderId={detailsId} onClose={() => setDetailsId(null)} />
      )}

        </>
      )}

    </div>
  );
}

function ManualProfitsView() {
  const [manualProfits, setManualProfits] = useState({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const authData = JSON.parse(localStorage.getItem("auth"));
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/settings/all`, {
          headers: { "Authorization": `Bearer ${authData?.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const map = {};
          data.forEach(s => {
            const k = `${s.year}-${String(s.month).padStart(2, "0")}`;
            map[k] = s.manual_profit;
          });
          setManualProfits(map);
        }
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (mKey, val) => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const [y, m] = mKey.split("-");
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/settings`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${authData?.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          year: parseInt(y), month: parseInt(m), manual_profit: val === "" ? null : parseFloat(val)
        })
      });
    } catch(e) { console.error(e); }
  };

  if (loading) return <p>Ładowanie formularza...</p>;

  return (
    <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <h2 style={{ marginTop: 0 }}>Ręczna edycja dochodów na wykresie</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Wpisane tutaj wartości nadpiszą automatyczne wyliczenia netto na wykresie głównym. Zostaw pole puste, aby przywrócić wyliczenie automatyczne z zakończonych zleceń.
      </p>

      <div style={{ marginBottom: '25px' }}>
        <label style={{ fontWeight: 'bold' }}>Wybierz rok: </label>
        <select 
          value={year} 
          onChange={e => setYear(parseInt(e.target.value))} 
          className="form-select" 
          style={{ width: '120px', display: 'inline-block', marginLeft: '10px' }}
        >
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
        {Array.from({length: 12}, (_, i) => i + 1).map(m => {
          const mKey = `${year}-${String(m).padStart(2, "0")}`;
          return (
            <div key={mKey} style={{ background: 'var(--bg-gray)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                {new Date(0, m - 1).toLocaleString('pl-PL', {month: 'long'})}
              </label>
              <input 
                type="number" 
                value={manualProfits[mKey] !== undefined && manualProfits[mKey] !== null ? manualProfits[mKey] : ""}
                onChange={e => setManualProfits(prev => ({...prev, [mKey]: e.target.value}))}
                onBlur={e => handleSave(mKey, e.target.value)}
                className="form-input"
                placeholder="Auto"
                style={{ width: '100%', textAlign: 'center', fontSize: '1.1rem', padding: '8px' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}