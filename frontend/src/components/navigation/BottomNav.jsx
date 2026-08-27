import { NavLink } from "react-router-dom";
import "./bottomNav.css";

export default function BottomNav({ user }) {
  const navItems = [
    { to: "/", label: "Start", icon: "🏠" },
    { to: "/orders", label: "Zlecenia", icon: "📋" },
    { to: "/clients", label: "Klienci", icon: "👤" },
    { to: "/calendar", label: "Kalendarz", icon: "📅" },
    { to: "/accounting", label: "Księgowość", icon: "📊" },
    { to: "/finance", label: "Finanse", icon: "💳" },
    { to: "/offers", label: "Oferty", icon: "📄" },
    { to: "/issues", label: "Zgłoszenia", icon: "💬" },
  ];

  if (user?.role === "admin") {
    navItems.push({ to: "/users", label: "Użytkownicy", icon: "👥" });
  }

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            isActive ? "bottom-nav-item active" : "bottom-nav-item"
          }
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
