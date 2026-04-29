import { useState, useEffect } from "react";
import EntriesList from "./EntriesList";
import TaxDashboard from "./TaxDashboard";

import "./accounting.css";

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("taxes");

  return (
    <div className="accounting-container">
      <div className="accounting-header">
        <h1 className="accounting-title">Ewidencja Księgowa</h1>
        <div className="accounting-tabs">
          <button 
            className={`tab-btn ${activeTab === "taxes" ? "active" : ""}`}
            onClick={() => setActiveTab("taxes")}
          >
            📊 Statystyki i Podatki
          </button>
          <button 
            className={`tab-btn ${activeTab === "revenue" ? "active" : ""}`}
            onClick={() => setActiveTab("revenue")}
          >
            💰 Przychody
          </button>
          <button 
            className={`tab-btn ${activeTab === "expenses" ? "active" : ""}`}
            onClick={() => setActiveTab("expenses")}
          >
            💸 Koszty
          </button>
        </div>
      </div>

      <div className="accounting-content">
        {activeTab === "taxes" && <TaxDashboard />}
        {activeTab === "revenue" && <EntriesList type="revenue" />}
        {activeTab === "expenses" && <EntriesList type="expense" />}
      </div>

    </div>
  );
}
