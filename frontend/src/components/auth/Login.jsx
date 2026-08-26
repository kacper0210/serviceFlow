import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./auth.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("auth")) {
      navigate("/");
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Nieprawidłowy e-mail lub hasło");
      }

      localStorage.setItem("auth", JSON.stringify(result));
      window.dispatchEvent(new Event("auth-changed"));
      navigate("/");

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="premium-login-container">
      {/* Background Ambient Glow Orbs */}
      <div className="ambient-glow glow-1" />
      <div className="ambient-glow glow-2" />

      {/* Main Centered Glassmorphism Card */}
      <div className="premium-login-card">
        <div className="card-header">
          <div className="brand-logo">
            <span className="logo-icon-glow" />
            <span className="brand-title">ServiceFlow</span>
          </div>
          <h1 className="card-title">Zaloguj się do konta</h1>
          <p className="card-subtitle">Wpisz swoje dane, aby kontynuować pracę</p>
        </div>

        {error && (
          <div className="premium-error-alert">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="premium-form">
          <div className="form-group">
            <label htmlFor="login-email">Adres e-mail lub login</label>
            <input
              id="login-email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mail lub login (np. admin)"
              required
              className="premium-input"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Hasło</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="premium-input"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="premium-submit-btn"
            disabled={loading || !email || !password}
          >
            {loading ? "Weryfikacja..." : "Zaloguj się"}
          </button>
        </form>
      </div>
    </div>
  );
}