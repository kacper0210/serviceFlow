import { useEffect, useState } from "react";
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from "react-router-dom";
import "./App.css";

import ClientsList from "./components/clients/clientsList";
import OrdersList from "./components/orders/ordersList";
import OrdersCalendar from "./components/orders/ordersCalendar";
import Dashboard from "./components/dashboard/dashboard";
import Login from "./components/auth/Login";
import Settings from "./components/settings/Settings";
import Users from "./components/users/Users";
import Accounting from "./components/accounting/Accounting";


export default function App() {
  const [auth, setAuth] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const checkAuth = () => {
    try {
      const stored = localStorage.getItem("auth");
      if (stored) {
        setAuth(JSON.parse(stored));
      } else {
        setAuth(null);
      }
    } catch {
      setAuth(null);
    }
    setLoadingAuth(false);
  };

  useEffect(() => {
    checkAuth();

    window.addEventListener("auth-changed", checkAuth);

    if (localStorage.getItem("theme") === "dark") {
      document.body.classList.add("dark-mode");
    }

    return () => window.removeEventListener("auth-changed", checkAuth);
  }, []);

  if (loadingAuth) return null;

  return (
    <div className="app-layout">
      {auth && <Navbar user={auth.user} />}

      <main className="app-content">
        <Routes>
          <Route path="/login" element={!auth ? <Login /> : <Navigate to="/" />} />

          <Route path="/" element={<PrivateRoute auth={auth}><Dashboard /></PrivateRoute>} />
          <Route path="/clients" element={<PrivateRoute auth={auth}><ClientsList /></PrivateRoute>} />
          <Route path="/orders" element={<PrivateRoute auth={auth}><OrdersList /></PrivateRoute>} />
          <Route path="/calendar" element={<PrivateRoute auth={auth}><OrdersCalendar /></PrivateRoute>} />
          <Route path="/accounting" element={<PrivateRoute auth={auth}><Accounting /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute auth={auth}><Settings /></PrivateRoute>} />


          <Route path="/users" element={
            <PrivateRoute auth={auth}>
              {auth?.user?.role === "admin" ? <Users /> : <Navigate to="/" />}
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function PrivateRoute({ auth, children }) {
  return auth ? children : <Navigate to="/login" />;
}

function Navbar({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("auth");
    window.dispatchEvent(new Event("auth-changed"));
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="nav-brand">System Zleceń</div>

      <div className="nav-links">
        <NavLink to="/" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Start</NavLink>
        <NavLink to="/orders" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Zlecenia</NavLink>
        <NavLink to="/clients" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Klienci</NavLink>
        <NavLink to="/calendar" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Kalendarz</NavLink>
        <NavLink to="/accounting" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Księgowość</NavLink>
        {user.role === "admin" && (

          <NavLink to="/users" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>Użytkownicy</NavLink>
        )}
      </div>

      <div className="nav-user">
        <button
          onClick={() => {
            const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
            if (newTheme === 'dark') document.body.classList.add('dark-mode');
            else document.body.classList.remove('dark-mode');
            localStorage.setItem("theme", newTheme);
          }}
          className="theme-toggle-btn"
          title="Przełącz motyw"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.2rem',
            marginRight: '15px',
            color: 'var(--text-main)'
          }}
        >
          ◑
        </button>

        <div className="user-avatar" onClick={() => setMenuOpen(!menuOpen)}>
          {user.email.substring(0, 2).toUpperCase()}
        </div>

        {menuOpen && (
          <div className="user-dropdown">
            <div className="dropdown-item" onClick={() => { navigate("/settings"); setMenuOpen(false); }}>Ustawienia</div>
            <div className="dropdown-item text-danger" onClick={handleLogout}>Wyloguj</div>
          </div>
        )}
      </div>
    </nav>
  );
}