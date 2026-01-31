import React, { forwardRef, useImperativeHandle } from "react";

const StepBasicInfo = forwardRef(
  ({ config, updateConfig, showErrors }, ref) => {
    const errors = {
      clinic_name: !config.clinic_name?.trim()
        ? "Clinic name is required"
        : null,
      clinic_phone: !config.clinic_phone?.trim()
        ? "Phone number is required"
        : null,
      practice_type: !config.practice_type ? "Practice type is required" : null,
    };

    useImperativeHandle(ref, () => ({
      validate: () => !Object.values(errors).some((error) => error !== null),
    }));

    const inputClass = (fieldName) =>
      `input ${showErrors && errors[fieldName] ? "input-error" : ""}`;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter text-charcoal">
            Welcome to Heidi Calls Setup
          </h2>
          <p className="mt-2 text-slate-600">
            Let's get your clinic configured. This will take about 5 minutes.
            We'll set up how Heidi handles calls during and after business
            hours.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Clinic Name *</label>
            <input
              type="text"
              value={config.clinic_name || ""}
              onChange={(e) => updateConfig({ clinic_name: e.target.value })}
              placeholder="e.g., Northside Medical Clinic"
              className={inputClass("clinic_name")}
            />
            {showErrors && errors.clinic_name && (
              <p className="field-error">{errors.clinic_name}</p>
            )}
          </div>

          <div>
            <label className="label">Clinic Phone Number *</label>
            <input
              type="tel"
              value={config.clinic_phone || ""}
              onChange={(e) => updateConfig({ clinic_phone: e.target.value })}
              placeholder="e.g., 02 9123 4567"
              className={inputClass("clinic_phone")}
            />
            {showErrors && errors.clinic_phone && (
              <p className="field-error">{errors.clinic_phone}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Practice Type *</label>
              <select
                value={config.practice_type || ""}
                onChange={(e) =>
                  updateConfig({ practice_type: e.target.value })
                }
                className={inputClass("practice_type")}
              >
                <option value="">Select...</option>
                <option value="gp">General Practice</option>
                <option value="specialist">Specialist Practice</option>
                <option value="allied">Allied Health</option>
                <option value="dental">Dental</option>
                <option value="other">Other</option>
              </select>
              {showErrors && errors.practice_type && (
                <p className="field-error">{errors.practice_type}</p>
              )}
            </div>

            <div>
              <label className="label">Number of Practitioners</label>
              <select
                value={config.practitioner_count || ""}
                onChange={(e) =>
                  updateConfig({ practitioner_count: e.target.value })
                }
                className="input"
              >
                <option value="">Select...</option>
                <option value="1">Solo practice (1)</option>
                <option value="2-5">Small (2-5)</option>
                <option value="6-10">Medium (6-10)</option>
                <option value="10+">Large (10+)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-sunlight/30 border border-sunlight rounded-xl p-4">
          <div className="flex gap-3">
            <span className="text-lg">💡</span>
            <div>
              <p className="font-medium text-charcoal">Why we need this</p>
              <p className="text-sm text-slate-600 mt-1">
                This information helps Heidi identify your clinic to callers and
                provide accurate information.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export default StepBasicInfo;
