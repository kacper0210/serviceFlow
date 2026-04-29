import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import AddClientForm from "../clients/addClientForm";
import AddOrderForm from "../orders/addOrderForm";
import "./dashboard.css";

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [clientsCount, setClientsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [manualProfits, setManualProfits] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const token = authData?.token;
      const headers = { "Authorization": `Bearer ${token}` };

      const [ordersRes, clientsRes, settingsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`, { headers }),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/settings/all`, { headers })
      ]);

      if (!ordersRes.ok || !clientsRes.ok) throw new Error("Błąd pobierania danych");

      const ordersData = await ordersRes.json();
      const clientsData = await clientsRes.json();
      let settingsData = [];
      if (settingsRes.ok) {
        settingsData = await settingsRes.json();
      }

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setClientsCount(Array.isArray(clientsData) ? clientsData.length : 0);
      
      const profitsMap = {};
      settingsData.forEach(s => {
        const k = `${s.year}-${String(s.month).padStart(2, "0")}`;
        profitsMap[k] = s.manual_profit;
      });
      setManualProfits(profitsMap);
      setError("");
    } catch (e) {
      console.error(e);
      setError("Nie udało się załadować danych dashboardu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const counts = { nowe: 0, w_trakcie: 0, zakonczone: 0 };
    orders.forEach(o => {
      const st = (o.status || "").toLowerCase();
      if (st === "nowe") counts.nowe++;
      else if (st === "w_trakcie") counts.w_trakcie++;
      else if (st.includes("zako")) counts.zakonczone++;
    });
    return counts;
  }, [orders]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleString("pl-PL", { month: "short" }),
        calculatedValue: 0,
        value: 0
      };
    });

    orders.forEach(o => {
      if (!(o.status || "").includes("zako")) return;

      const date = o.deadline ? new Date(o.deadline) : new Date(o.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const monthObj = months.find(m => m.key === key);
      if (monthObj) {
        const price = parseFloat(String(o.price).replace(",", ".")) || 0;
        const totalCosts = parseFloat(o.total_costs) || 0;
        monthObj.calculatedValue += (price - totalCosts);
      }
    });

    // Apply manual profits if present
    months.forEach(m => {
      if (manualProfits[m.key] !== undefined && manualProfits[m.key] !== null && manualProfits[m.key] !== "") {
        m.value = parseFloat(manualProfits[m.key]);
      } else {
        m.value = m.calculatedValue;
      }
    });

    const maxVal = Math.max(...months.map(m => m.value), 100);
    return { months, maxVal };
  }, [orders, manualProfits]);

  const recentActivity = useMemo(() => {
    const sorted = [...orders].sort((a, b) =>
      new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
    return sorted.slice(0, 5);
  }, [orders]);

  return (
    <div className="dashboard-container">
      {loading ? (
        <p className="loading-text">Ładowanie statystyk...</p>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : (
        <>
          <section className="dashboard-metrics-grid">
            <Link to="/orders?status=nowe" className="dashboard-tile status-tile-new">
              <p className="tile-header">Nowe Zlecenia</p>
              <div className="tile-count">{stats.nowe}</div>
              <div className="tile-sub">Oczekujące na realizację</div>
            </Link>

            <Link to="/orders?status=w_trakcie" className="dashboard-tile status-tile-progress">
              <p className="tile-header">W Realizacji</p>
              <div className="tile-count">{stats.w_trakcie}</div>
              <div className="tile-sub">Zlecenia w trakcie</div>
            </Link>

            <Link to="/orders?status=zakonczone" className="dashboard-tile status-tile-done">
              <p className="tile-header">Zakończone</p>
              <div className="tile-count">{stats.zakonczone}</div>
              <div className="tile-sub">Zysk osiągnięty</div>
            </Link>

            <Link to="/clients" className="dashboard-tile status-tile-clients">
              <p className="tile-header">Klienci</p>
              <div className="tile-count">{clientsCount}</div>
              <div className="tile-sub">Wszyscy w bazie</div>
            </Link>
          </section>

          <div className="dashboard-charts-grid">

            <section className="dashboard-card">
              <h2 className="section-header">Zysk Netto (Przychód - Koszty)</h2>
              <LineChart data={monthlyData.months} max={monthlyData.maxVal} />
            </section>


            <section className="dashboard-card">
              <h2 className="section-header">
                🚀 Ostatnio dodane
              </h2>
              {recentActivity.length > 0 ? (
                <ul className="activity-list">
                  {recentActivity.map(order => (
                    <li key={order.id} className="activity-item">
                      <div className="activity-info">
                        <span className="activity-title">#{order.id} {order.title}</span>
                        <span className="activity-status">{order.status}</span>
                      </div>
                      <span className="activity-date">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Brak zleceń.</p>
              )}
            </section>
          </div>
        </>
      )}

    </div>
  );
}

function LineChart({ data, max }) {
  if (!data || data.length === 0) return null;

  const width = 800;
  const height = 300;
  const padding = 40;

  const getX = (index) => padding + (index * (width - 2 * padding)) / (data.length - 1);
  const getY = (value) => height - padding - (value / max) * (height - 2 * padding);

  // Generate cubic bezier path for smooth line
  const points = data.map((d, i) => ({ x: getX(i), y: getY(d.value) }));
  
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cp1x = curr.x + (next.x - curr.x) / 2;
    const cp2x = curr.x + (next.x - curr.x) / 2;
    d += ` C ${cp1x} ${curr.y}, ${cp2x} ${next.y}, ${next.x} ${next.y}`;
  }

  const areaD = d + ` V ${height - padding} H ${padding} Z`;

  return (
    <div className="chart-container-wrapper">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = padding + p * (height - 2 * padding);
          return (
            <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} className="chart-grid-line" strokeDasharray="4 4" />
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#chart-gradient)" />

        {/* Smooth line */}
        <path d={d} className="chart-line" />

        {/* Points and labels */}
        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={getX(i)}
              cy={getY(d.value)}
              r="4"
              className="chart-point"
            />
            <text
              x={getX(i)}
              y={height - 15}
              textAnchor="middle"
              className="chart-label"
            >
              {d.label}
            </text>
            {d.value > 0 && (
              <text
                x={getX(i)}
                y={getY(d.value) - 12}
                textAnchor="middle"
                className="chart-value-label"
              >
                {Math.round(d.value)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}