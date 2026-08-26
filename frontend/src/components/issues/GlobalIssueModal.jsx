import { useState, useEffect, useRef } from "react";
import { API_URL } from "../../config";
import "./issues.css";

export default function GlobalIssueModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState("błąd");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Shortcut: Alt + S to open/toggle modal
      if (e.altKey && (e.key === "s" || e.key === "S" || e.code === "KeyS")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Esc to close modal if open
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open");
      if (textareaRef.current) {
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [isOpen]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          description: description.trim(),
        }),
      });

      if (res.ok) {
        setDescription("");
        setIsOpen(false);
        showToast("Zgłoszenie zapisane!");
        window.dispatchEvent(new Event("issue-added"));
      } else {
        alert("Błąd podczas zapisywania zgłoszenia.");
      }
    } catch (err) {
      console.error("Error creating issue:", err);
      alert("Błąd połączenia z serwerem.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleTextareaKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        className="issue-fab-button"
        onClick={() => setIsOpen(true)}
        title="Szybkie zgłoszenie błędu / sugestii (Alt + S)"
      >
        📝
      </button>

      {/* Toast message */}
      {toastMessage && <div className="issue-toast">✓ {toastMessage}</div>}

      {/* Global Modal */}
      {isOpen && (
        <div className="issue-modal-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="issue-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="issue-modal-header">
              <h3>Szybkie Zgłoszenie</h3>
              <button
                className="issue-modal-close"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="issue-type-selector">
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

            <textarea
              ref={textareaRef}
              className="issue-textarea"
              placeholder="Wpisz treść błędu lub sugestii..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
            />

            <div className="issue-modal-footer">
              <span className="issue-hint">Enter = Zapisz • Alt+S = Otwórz/Zamknij</span>
              <div className="issue-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsOpen(false)}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={!description.trim() || isSubmitting}
                >
                  {isSubmitting ? "Zapisywanie..." : "Zapisz"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
