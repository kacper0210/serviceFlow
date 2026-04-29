import { useState, useEffect } from "react";
import OrderDetails from "./orderDetails";
import "./orders.css"

export default function OrdersCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const authData = JSON.parse(localStorage.getItem("auth"));
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders`, {
          headers: { "Authorization": `Bearer ${authData?.token}` }
        });
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay === -1) startDay = 6;

  const calendarCells = [];

  for (let i = 0; i < startDay; i++) {
    calendarCells.push({ type: "empty", key: `empty-${i}` });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const daysOrders = orders.filter(o => o.deadline && o.deadline.startsWith(dateStr));

    calendarCells.push({
      type: "day",
      day: d,
      dateStr: dateStr,
      orders: daysOrders,
      isToday: new Date().toISOString().startsWith(dateStr)
    });
  }

  const totalCells = calendarCells.length;
  const remainingCells = 7 - (totalCells % 7);

  if (remainingCells < 7) {
    for (let i = 1; i <= remainingCells; i++) {
      calendarCells.push({
        type: "next-month",
        day: i,
        key: `next-${i}`
      });
    }
  }

  const changeMonth = (offset) => {
    setCurrentDate(new Date(year, month + offset, 1));
  };

  const monthNames = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

  return (
    <div className="orders-page-container">
      <div className="calendar-wrapper">

        <div className="cal-header">
          <button className="btn-secondary" onClick={() => changeMonth(-1)}>&lt; Poprzedni</button>
          <div className="cal-title">
            {monthNames[month]} {year}
          </div>
          <button className="btn-secondary" onClick={() => changeMonth(1)}>Następny &gt;</button>
        </div>

        <div className="cal-grid" style={{ background: "none", border: "none", marginBottom: 5 }}>
          {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"].map(day => (
            <div key={day} className="cal-day-name">{day}</div>
          ))}
        </div>

        <div className="cal-grid">
          {calendarCells.map((cell, index) => {
            if (cell.type === "empty") {
              return <div key={cell.key} className="cal-day-cell prev-month"></div>;
            }

            if (cell.type === "next-month") {
              return (
                <div key={cell.key} className="cal-day-cell next-month">
                  <span className="day-number">{cell.day}</span>
                </div>
              );
            }

            return (
              <div key={cell.dateStr} className={`cal-day-cell ${cell.isToday ? 'today' : ''}`}>
                <span className="day-number">{cell.day}</span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {cell.orders.map(o => (
                    <div
                      key={o.id}
                      className={`cal-event event-${o.status}`}
                      onClick={() => setSelectedOrderId(o.id)}
                      title={o.title}
                    >
                      {o.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedOrderId && (
        <OrderDetails orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
      )}
    </div>
  );
}