import React, { useState, useEffect } from "react";
import OnboardingWizard from "./components/OnboardingWizard";
import SimulationPanel from "./components/SimulationPanel";

const API_BASE = "http://localhost:3001/api";

function App() {
  const [clinicConfig, setClinicConfig] = useState(null);
  const [showSimulation, setShowSimulation] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE}/clinics`);
        if (response.ok) {
          const configs = await response.json();
          if (configs.length > 0) {
            const latestConfig = configs[configs.length - 1];
            setClinicConfig(latestConfig);
            setShowSimulation(true);
          }
        }
      } catch (error) {
        console.error("Failed to load config:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleOnboardingComplete = async (config) => {
    try {
      let savedConfig;
      if (isEditing && clinicConfig?.clinic_id) {
        // Try to update existing clinic
        const response = await fetch(
          `${API_BASE}/clinics/${clinicConfig.clinic_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
          },
        );

        if (response.ok) {
          savedConfig = await response.json();
        } else {
          // Clinic not found (server may have restarted) - create new one instead
          console.warn("Clinic not found on server, creating new one");
          const createResponse = await fetch(`${API_BASE}/clinics`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
          });
          savedConfig = await createResponse.json();
        }
      } else {
        const response = await fetch(`${API_BASE}/clinics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        savedConfig = await response.json();
      }
      setClinicConfig(savedConfig);
      setShowSimulation(true);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save config:", error);
      setClinicConfig(config);
      setShowSimulation(true);
      setIsEditing(false);
    }
  };

  const handleEditConfig = () => {
    setIsEditing(true);
    setShowSimulation(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setShowSimulation(true);
  };

  const handleRestart = () => {
    setClinicConfig(null);
    setShowSimulation(false);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-5xl mx-auto px-6 py-12">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="flex items-center gap-3 text-slate-500">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span>Loading...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        showActions={clinicConfig && showSimulation}
        isEditing={isEditing}
        onEdit={handleEditConfig}
        onReset={handleRestart}
        onCancel={handleCancelEdit}
      />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {!showSimulation ? (
          <OnboardingWizard
            onComplete={handleOnboardingComplete}
            initialConfig={isEditing ? clinicConfig : null}
            isEditing={isEditing}
          />
        ) : (
          <SimulationPanel config={clinicConfig} />
        )}
      </main>
    </div>
  );
}

function Header({ showActions, isEditing, onEdit, onReset, onCancel }) {
  return (
    <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-sunlight rounded-lg flex items-center justify-center">
            <span className="text-charcoal font-bold text-sm">H</span>
          </div>
          <h1 className="text-xl font-bold tracking-tighter text-charcoal">
            Heidi Calls
          </h1>
        </div>

        {showActions && (
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="btn btn-secondary btn-small">
              <svg
                className="w-4 h-4 mr-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </button>
            <button onClick={onReset} className="btn btn-secondary btn-small">
              <svg
                className="w-4 h-4 mr-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Reset
            </button>
          </div>
        )}

        {isEditing && (
          <button onClick={onCancel} className="btn btn-secondary btn-small">
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Cancel
          </button>
        )}
      </div>
    </header>
  );
}

export default App;
