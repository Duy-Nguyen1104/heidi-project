import React, { useState, useRef } from "react";
import StepBasicInfo from "./wizard/StepBasicInfo";
import StepSchedule from "./wizard/StepSchedule";
import StepStaff from "./wizard/StepStaff";
import StepPersona from "./wizard/StepPersona";
import StepWorkflows from "./wizard/StepWorkflows";
import StepReview from "./wizard/StepReview";
import { defaultConfig } from "../data/defaultConfig";

const STEPS = [
  { id: 1, label: "Basics", component: StepBasicInfo },
  { id: 2, label: "Hours", component: StepSchedule },
  { id: 3, label: "Staff", component: StepStaff },
  { id: 4, label: "Persona", component: StepPersona },
  { id: 5, label: "Workflows", component: StepWorkflows },
  { id: 6, label: "Review", component: StepReview },
];

function OnboardingWizard({ onComplete, initialConfig, isEditing }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState(
    initialConfig ? { ...initialConfig } : { ...defaultConfig }
  );
  const [showErrors, setShowErrors] = useState(false);
  const stepRef = useRef(null);

  const updateConfig = (updates) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    setShowErrors(true);
    if (stepRef.current?.validate) {
      const isValid = stepRef.current.validate();
      if (!isValid) return;
    }
    setShowErrors(false);
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    setShowErrors(false);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    const finalConfig = {
      ...config,
      clinic_id: `clinic_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    onComplete(finalConfig);
  };

  const CurrentStepComponent = STEPS[currentStep - 1].component;

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                    currentStep === step.id
                      ? "bg-charcoal text-white"
                      : currentStep > step.id
                      ? "bg-sunlight text-charcoal"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {currentStep > step.id ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    currentStep >= step.id ? "text-charcoal" : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 mt-[-1rem] ${
                    currentStep > step.id ? "bg-sunlight" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current step content */}
      <div className="card">
        <CurrentStepComponent
          ref={stepRef}
          config={config}
          updateConfig={updateConfig}
          showErrors={showErrors}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          className="btn btn-secondary"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Previous
        </button>

        {currentStep < STEPS.length ? (
          <button className="btn btn-primary" onClick={nextStep}>
            Next
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        ) : (
          <button className="btn btn-sunlight" onClick={handleComplete}>
            {isEditing ? "Save Changes" : "Complete Setup"}
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default OnboardingWizard;
