import { useState } from "react";
import EntriesList from "./EntriesList";
import TaxDashboard from "./TaxDashboard";
import KsefIntegration from "./KsefIntegration";
import TaxInfo from "./TaxInfo";

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
            Podatki i Statystyki
          </button>
          <button 
            className={`tab-btn ${activeTab === "revenue" ? "active" : ""}`}
            onClick={() => setActiveTab("revenue")}
          >
            Przychody
          </button>
          <button 
            className={`tab-btn ${activeTab === "expenses" ? "active" : ""}`}
            onClick={() => setActiveTab("expenses")}
          >
            Koszty
          </button>
          <button 
            className={`tab-btn ${activeTab === "ksef" ? "active" : ""}`}
            onClick={() => setActiveTab("ksef")}
          >
            Integracja KSeF
          </button>
          <button 
            className={`tab-btn ${activeTab === "tax_info" ? "active" : ""}`}
            onClick={() => setActiveTab("tax_info")}
          >
            Informacje Podatkowe
          </button>
        </div>
      </div>

      <div className="accounting-content">
        {activeTab === "taxes" && <TaxDashboard />}
        {activeTab === "revenue" && <EntriesList type="revenue" />}
        {activeTab === "expenses" && <EntriesList type="expense" />}
        {activeTab === "ksef" && <KsefIntegration />}
        {activeTab === "tax_info" && <TaxInfo />}
      </div>

    </div>
  );
}
