import { useState, useEffect } from "react";
import { API_URL } from "../../config";
import "./issues.css";

export default function IssuesList() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // 'all', 'open', 'done'

  // Form state for inline creation
  const [type, setType] = useState("błąd");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchIssues = async () => {
    try {
      const res = await fetch(`${API_URL}/api/issues`);
      if (res.ok) {
        const data = await res.json();
        setIssues(data);
      }
    } catch (err) {
      console.error("Error fetching issues:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();

    const handleIssueAdded = () => fetchIssues();
    window.addEventListener("issue-added", handleIssueAdded);
    return () => window.removeEventListener("issue-added", handleIssueAdded);
  }, []);

  const handleAddIssue = async (e) => {
    e.preventDefault();
    if (!description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description: description.trim() }),
      });

      if (res.ok) {
        setDescription("");
        fetchIssues();
      }
    } catch (err) {
      console.error("Error adding issue:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (issue) => {
    const newStatus = issue.status === "open" ? "done" : "open";
    
    // Optimistic UI update
    setIssues((prev) => {
      const updated = prev.map((item) =>
        item.id === issue.id ? { ...item, status: newStatus } : item
      );
      // Re-sort: open first, done last, then by created_at DESC
      return updated.sort((a, b) => {
        if (a.status === b.status) {
          return new Date(b.created_at) - new Date(a.created_at);
        }
        return a.status === "open" ? -1 : 1;
      });
    });

    try {
      const res = await fetch(`${API_URL}/api/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) fetchIssues(); // Revert on failure
    } catch (err) {
      console.error("Error updating issue status:", err);
      fetchIssues();
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć to zgłoszenie?")) return;

    setIssues((prev) => prev.filter((item) => item.id !== id));

    try {
      await fetch(`${API_URL}/api/issues/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Error deleting issue:", err);
      fetchIssues();
    }
  };

  const filteredIssues = issues.filter((item) => {
    if (filter === "open") return item.status === "open";
    if (filter === "done") return item.status === "done";
    return true;
  });

  const openCount = issues.filter((i) => i.status === "open").length;

  return (
    <div className="issues-container">
      <div className="issues-header">
        <h2>Błędy i Sugestie ({openCount} do zrobienia)</h2>
      </div>

      {/* Quick Inline Creation Form */}
      <form onSubmit={handleAddIssue} style={{ marginBottom: "24px" }}>
        <div className="issue-type-selector" style={{ marginBottom: "10px" }}>
          <button
            type="button"
            className={`issue-type-btn ${type === "błąd" ? "active bug" : ""}`}
            onClick={() => setType("błąd")}
          >
            🐛 Błąd
          </button>
          <button
            type="button"
            className={`issue-type-btn ${type === "sugestia" ? "active suggestion" : ""}`}
            onClick={() => setType("sugestia")}
          >
            💡 Sugestia
          </button>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            className="issue-textarea"
            style={{ minHeight: "auto", height: "42px", marginBottom: 0 }}
            placeholder="Wpisz treść nowego zgłoszenia..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={!description.trim() || isSubmitting}
            style={{ whiteSpace: "nowrap" }}
          >
            Dodaj
          </button>
        </div>
      </form>

      {/* Filter Bar */}
      <div className="issues-filter-bar">
        <button
          className={`filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          Wszystkie ({issues.length})
        </button>
        <button
          className={`filter-btn ${filter === "open" ? "active" : ""}`}
          onClick={() => setFilter("open")}
        >
          Do zrobienia ({openCount})
        </button>
        <button
          className={`filter-btn ${filter === "done" ? "active" : ""}`}
          onClick={() => setFilter("done")}
        >
          Wykonane ({issues.length - openCount})
        </button>
      </div>

      {/* Issues List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "20px" }}>Ładowanie...</div>
      ) : filteredIssues.length === 0 ? (
        <div className="issues-empty">Brak zgłoszeń w tej kategoria.</div>
      ) : (
        <div className="issues-list">
          {filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className={`issue-item ${issue.status === "done" ? "done" : ""}`}
            >
              <input
                type="checkbox"
                className="issue-checkbox"
                checked={issue.status === "done"}
                onChange={() => handleToggleStatus(issue)}
              />
              <div className="issue-content">
                <span className={`issue-badge ${issue.type}`}>
                  {issue.type === "błąd" ? "🐛 Błąd" : "💡 Sugestia"}
                </span>
                <div className="issue-text">{issue.description}</div>
                <div className="issue-date">
                  {new Date(issue.created_at).toLocaleString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <button
                className="issue-delete-btn"
                onClick={() => handleDelete(issue.id)}
                title="Usuń zgłoszenie"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
