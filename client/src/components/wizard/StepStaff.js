import React, { forwardRef, useImperativeHandle } from "react";

const StepStaff = forwardRef(({ config, updateConfig, showErrors }, ref) => {
  const staff = config.staff_directory || [];
  const noStaffError =
    staff.length === 0 ? "At least one practitioner must be added" : null;
  const staffNameErrors = staff.map((member) =>
    !member.name?.trim() ? "Name is required" : null,
  );
  const hasErrors = noStaffError || staffNameErrors.some((e) => e !== null);

  useImperativeHandle(ref, () => ({ validate: () => !hasErrors }));

  const addStaffMember = () => {
    const newStaff = {
      id: `staff_${Date.now()}`,
      name: "",
      role: "GP",
      booking_rules: {
        accepts_new_patients: true,
        requires_manual_approval: false,
        specializations: [],
      },
    };
    updateConfig({ staff_directory: [...staff, newStaff] });
  };

  const updateStaffMember = (index, updates) => {
    const updated = [...staff];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ staff_directory: updated });
  };

  const updateBookingRules = (index, ruleUpdates) => {
    const updated = [...staff];
    updated[index] = {
      ...updated[index],
      booking_rules: { ...updated[index].booking_rules, ...ruleUpdates },
    };
    updateConfig({ staff_directory: updated });
  };

  const removeStaffMember = (index) => {
    updateConfig({ staff_directory: staff.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tighter text-charcoal">
          Staff & Booking Rules
        </h2>
        <p className="mt-2 text-slate-600">
          Add your practitioners and their booking preferences. Heidi will
          respect these rules when handling appointment requests.
        </p>
      </div>

      <div className="space-y-4">
        {staff.length === 0 && (
          <div
            className={`rounded-xl p-4 ${
              showErrors && noStaffError
                ? "bg-red-50 border border-red-200"
                : "bg-slate-50 border border-slate-200"
            }`}
          >
            <p
              className={
                showErrors && noStaffError ? "text-red-600" : "text-slate-600"
              }
            >
              {showErrors && noStaffError
                ? "⚠️ At least one practitioner must be added to continue."
                : "No staff members added yet. Add your practitioners so Heidi knows how to handle appointment requests for specific doctors."}
            </p>
          </div>
        )}

        {staff.map((member, index) => (
          <div
            key={member.id}
            className="bg-slate-50 rounded-xl p-5 border border-slate-200"
          >
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-charcoal">
                Practitioner #{index + 1}
              </h4>
              <button
                onClick={() => removeStaffMember(index)}
                className="text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Name *</label>
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) =>
                    updateStaffMember(index, { name: e.target.value })
                  }
                  placeholder="e.g., Dr. Sarah Smith"
                  className={`input ${
                    showErrors && staffNameErrors[index] ? "input-error" : ""
                  }`}
                />
                {showErrors && staffNameErrors[index] && (
                  <p className="field-error">{staffNameErrors[index]}</p>
                )}
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  value={member.role}
                  onChange={(e) =>
                    updateStaffMember(index, { role: e.target.value })
                  }
                  className="input"
                >
                  <option value="GP">GP</option>
                  <option value="Specialist">Specialist</option>
                  <option value="Nurse">Nurse</option>
                  <option value="Allied Health">Allied Health</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="label">Booking Rules</label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={member.booking_rules?.accepts_new_patients ?? true}
                    onChange={(e) =>
                      updateBookingRules(index, {
                        accepts_new_patients: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-charcoal focus:ring-charcoal"
                  />
                  Accepts new patients
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      member.booking_rules?.requires_manual_approval ?? false
                    }
                    onChange={(e) =>
                      updateBookingRules(index, {
                        requires_manual_approval: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-charcoal focus:ring-charcoal"
                  />
                  Requires manual approval
                </label>
              </div>
            </div>

            <div className="mt-4">
              <label className="label">Specializations (optional)</label>
              <input
                type="text"
                value={member.booking_rules?.specializations?.join(", ") || ""}
                onChange={(e) =>
                  updateBookingRules(index, {
                    specializations: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="e.g., General Medicine, Sports Medicine"
                className="input"
              />
              <p className="text-xs text-slate-500 mt-1">
                Separate with commas
              </p>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addStaffMember} className="btn btn-secondary">
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
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add Practitioner
      </button>

      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
        <div>
          <label className="label">Unknown Clinician Requests</label>
          <select
            value={
              config.defaults?.unknown_clinician_request ||
              "offer_next_available"
            }
            onChange={(e) =>
              updateConfig({
                defaults: {
                  ...config.defaults,
                  unknown_clinician_request: e.target.value,
                },
              })
            }
            className="input"
          >
            <option value="offer_next_available">Offer next available</option>
            <option value="take_message">Take a message</option>
            <option value="escalate">Transfer to reception</option>
          </select>
        </div>

        <div>
          <label className="label">New Patient Bookings</label>
          <select
            value={config.defaults?.new_patient_booking || "requires_approval"}
            onChange={(e) =>
              updateConfig({
                defaults: {
                  ...config.defaults,
                  new_patient_booking: e.target.value,
                },
              })
            }
            className="input"
          >
            <option value="allow">Allow booking directly</option>
            <option value="requires_approval">Requires approval</option>
            <option value="take_message">Take message only</option>
          </select>
        </div>
      </div> */}
    </div>
  );
});

export default StepStaff;
