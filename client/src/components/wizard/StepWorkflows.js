import React, { useState, forwardRef, useImperativeHandle } from "react";

const AVAILABLE_ACTIONS = [
  {
    id: "book_appointment",
    label: "Book appointments",
    description: "Schedule new appointments",
  },
  {
    id: "cancel_appointment",
    label: "Cancel appointments",
    description: "Process cancellation requests",
  },
  {
    id: "reschedule_appointment",
    label: "Reschedule appointments",
    description: "Change existing bookings",
  },
  {
    id: "take_message",
    label: "Take messages",
    description: "Record messages for staff",
  },
  // {
  //   id: "provide_clinic_info",
  //   label: "Provide clinic info",
  //   description: "Hours, location, services",
  // },
  {
    id: "conduct_followup_script",
    label: "Conduct follow-up calls",
    description: "Outbound patient check-ins",
  },
];

const StepWorkflows = forwardRef(
  ({ config, updateConfig, showErrors }, ref) => {
    const [newKeyword, setNewKeyword] = useState("");
    const workflows = config.workflow_rules || {};
    const classification = config.call_classification || {};
    const aiScope = config.ai_scope || {};

    const actionsError =
      !aiScope.allowed_actions || aiScope.allowed_actions.length === 0
        ? "At least one action must be selected"
        : null;

    useImperativeHandle(ref, () => ({ validate: () => !actionsError }));

    const updateWorkflows = (updates) =>
      updateConfig({ workflow_rules: { ...workflows, ...updates } });
    const updateClassification = (updates) =>
      updateConfig({ call_classification: { ...classification, ...updates } });
    const updateAIScope = (updates) =>
      updateConfig({ ai_scope: { ...aiScope, ...updates } });

    const toggleAction = (action) => {
      const current = aiScope.allowed_actions || [];
      updateAIScope({
        allowed_actions: current.includes(action)
          ? current.filter((a) => a !== action)
          : [...current, action],
      });
    };

    const addKeyword = () => {
      if (newKeyword.trim()) {
        updateClassification({
          escalation_triggers: {
            ...classification.escalation_triggers,
            keywords: [
              ...(classification.escalation_triggers?.keywords || []),
              newKeyword.trim(),
            ],
          },
        });
        setNewKeyword("");
      }
    };

    const removeKeyword = (idx) => {
      updateClassification({
        escalation_triggers: {
          ...classification.escalation_triggers,
          keywords: classification.escalation_triggers?.keywords.filter(
            (_, i) => i !== idx,
          ),
        },
      });
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter text-charcoal">
            Call Handling Workflows
          </h2>
          <p className="mt-2 text-slate-600">
            Configure how Heidi handles different types of calls and what
            actions it's allowed to take.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-charcoal mb-3">
            🤖 What Can Heidi Do?
          </h3>
          <label className="label">Allowed Actions *</label>
          <div
            className={`space-y-2 ${
              showErrors && actionsError
                ? "ring-2 ring-red-300 rounded-xl p-3"
                : ""
            }`}
          >
            {AVAILABLE_ACTIONS.map((action) => (
              <label
                key={action.id}
                className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={(aiScope.allowed_actions || []).includes(action.id)}
                  onChange={() => toggleAction(action.id)}
                  className="w-5 h-5 mt-0.5 rounded border-slate-300 text-charcoal focus:ring-charcoal"
                />
                <div>
                  <span className="font-medium text-charcoal">
                    {action.label}
                  </span>
                  <span className="text-slate-500 ml-2">
                    — {action.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
          {showErrors && actionsError && (
            <p className="field-error">{actionsError}</p>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-medium text-amber-800">🚫 Always Out of Scope</p>
          <p className="text-sm text-amber-700 mt-1">
            Medical advice, prescription changes, test result interpretation,
            symptom diagnosis. These always escalate to staff.
          </p>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-charcoal mb-4">
            📞 Business Hours Handling
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Default Action</label>
              <select
                value={
                  workflows.business_hours_logic?.inbound_call_action ||
                  "attempt_resolution"
                }
                onChange={(e) =>
                  updateWorkflows({
                    business_hours_logic: {
                      ...workflows.business_hours_logic,
                      inbound_call_action: e.target.value,
                    },
                  })
                }
                className="input"
              >
                <option value="attempt_resolution">
                  Try to resolve (recommended)
                </option>
                <option value="take_message">Always take message</option>
                <option value="transfer">Always transfer to staff</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    workflows.business_hours_logic?.live_transfer_enabled ??
                    true
                  }
                  onChange={(e) =>
                    updateWorkflows({
                      business_hours_logic: {
                        ...workflows.business_hours_logic,
                        live_transfer_enabled: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5 rounded border-slate-300 text-charcoal focus:ring-charcoal"
                />
                <span className="text-slate-600">
                  Enable live transfers to staff
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-charcoal mb-4">
            🌙 After Hours Handling
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Default Action</label>
              <select
                value={
                  workflows.after_hours_logic?.inbound_call_action ||
                  "take_message"
                }
                onChange={(e) =>
                  updateWorkflows({
                    after_hours_logic: {
                      ...workflows.after_hours_logic,
                      inbound_call_action: e.target.value,
                    },
                  })
                }
                className="input"
              >
                <option value="take_message">Take message (recommended)</option>
                <option value="voicemail_only">Voicemail only</option>
                <option value="attempt_resolution">
                  Try to resolve (if able)
                </option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    workflows.after_hours_logic?.voicemail_transcription ?? true
                  }
                  onChange={(e) =>
                    updateWorkflows({
                      after_hours_logic: {
                        ...workflows.after_hours_logic,
                        voicemail_transcription: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5 rounded border-slate-300 text-charcoal focus:ring-charcoal"
                />
                <span className="text-slate-600">Transcribe voicemails</span>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-lg font-semibold text-charcoal mb-2">
            🚨 Escalation Triggers
          </h3>
          <p className="text-slate-500 text-sm mb-4">
            These keywords will trigger immediate escalation or special
            handling.
          </p>

          <div className="mb-4">
            <label className="label">Escalation Keywords</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(classification.escalation_triggers?.keywords || []).map(
                (kw, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-orange-100 text-orange-700 text-sm rounded-full flex items-center gap-1"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(i)}
                      className="hover:text-orange-900 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ),
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add keyword..."
                className="input flex-1"
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addKeyword())
                }
              />
              <button
                onClick={addKeyword}
                disabled={!newKeyword.trim()}
                className="btn btn-secondary btn-small"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="label">Max Resolution Attempts</label>
            <select
              value={
                classification.escalation_triggers?.max_resolution_attempts || 2
              }
              onChange={(e) =>
                updateClassification({
                  escalation_triggers: {
                    ...classification.escalation_triggers,
                    max_resolution_attempts: parseInt(e.target.value),
                  },
                })
              }
              className="input w-48"
            >
              <option value="1">1 attempt</option>
              <option value="2">2 attempts (recommended)</option>
              <option value="3">3 attempts</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              If Heidi can't resolve after this many tries, it will escalate to
              staff.
            </p>
          </div>
        </div>
      </div>
    );
  },
);

export default StepWorkflows;
