import { Routes, Route, Link, Navigate } from "react-router-dom";
import { useState } from "react";

// 🧍 Komponenty klientów
import ClientsList from "./components/clients/clientsList";
import AddClientForm from "./components/clients/addClientForm";

// 🧾 Komponenty zleceń
import OrdersList from "./components/orders/ordersList";
import AddOrderForm from "./components/orders/addOrderForm";

export default function App() {
  const [refreshClients, setRefreshClients] = useState(false);
  const [refreshOrders, setRefreshOrders] = useState(false);

  return (
    <div style={layout}>
      {/* 🔝 Pasek menu */}
      <header style={headerStyle}>
        <h2 style={logoStyle}>ServiceFlow</h2>
        <nav style={navStyle}>
          <Link to="/clients" style={linkStyle}>Klienci</Link>
          <Link to="/orders" style={linkStyle}>Zlecenia</Link>
          <Link to="/calendar" style={linkStyle}>Kalendarz</Link>
          <Link to="/settings" style={linkStyle}>Ustawienia</Link>
        </nav>
      </header>

      {/* 🧭 Główna zawartość */}
      <main style={mainStyle}>
        <Routes>
          <Route
            path="/clients"
            element={
              <PageLayout
                title="Klienci"
                addSection={
                  <AddClientForm onClientAdded={() => setRefreshClients(prev => !prev)} />
                }
                listSection={
                  <ClientsList refreshTrigger={refreshClients} />
                }
              />
            }
          />

          <Route
            path="/orders"
            element={
              <PageLayout
                title="Zlecenia"
                addSection={
                  <AddOrderForm onOrderAdded={() => setRefreshOrders(prev => !prev)} />
                }
                listSection={
                  <OrdersList refreshTrigger={refreshOrders} />
                }
              />
            }
          />

          <Route path="/" element={<Navigate to="/clients" />} />
        </Routes>
      </main>
    </div>
  );
}

/* 🧩 Wspólny układ sekcji strony (formularz + lista) */
function PageLayout({ title, addSection, listSection }) {
  return (
    <div>
      <h1 style={pageTitle}>{title}</h1>

      <section style={section}>
        <h2 style={sectionTitle}>Dodaj {title.toLowerCase().slice(0, -1)}</h2>
        {addSection}
      </section>

      <section style={section}>
        <h2 style={sectionTitle}>Lista {title.toLowerCase()}</h2>
        {listSection}
      </section>
    </div>
  );
}

/* 🎨 STYLE */
const layout = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
};

const headerStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  background: "#382e2e",
  padding: "15px 40px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  color: "white",
  zIndex: 1000,
  boxSizing: "border-box",
};

const logoStyle = { margin: 0, fontSize: "1.5rem" };
const navStyle = { display: "flex", gap: "25px" };

const linkStyle = {
  color: "white",
  textDecoration: "none",
  fontWeight: "bold",
  transition: "opacity 0.2s",
};

const mainStyle = {
  flexGrow: 1,
  width: "100vw",
  minHeight: "100vh",
  margin: 0,
  padding: "100px 40px 40px",
  color: "#222",
  background: "#f6f6f6",
  overflowY: "auto",
  boxSizing: "border-box",
};

const pageTitle = {
  textAlign: "center",
  color: "#222",
  marginBottom: "30px",
};

const section = {
  marginBottom: "40px",
  background: "white",
  padding: "20px",
  borderRadius: "10px",
  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
};

const sectionTitle = { color: "#333", marginBottom: "15px" };
