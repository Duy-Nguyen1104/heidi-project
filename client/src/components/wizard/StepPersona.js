import React, { useState, forwardRef, useImperativeHandle } from "react";

const TONE_OPTIONS = [
  {
    id: "empathetic",
    name: "Empathetic",
    description: "Warm, caring, acknowledges patient feelings",
    example: '"Hello, thank you for calling. I\'m here to help you today."',
  },
  {
    id: "professional",
    name: "Professional",
    description: "Courteous, efficient, business-like",
    example:
      '"Good day, you\'ve reached Northside Clinic. How may I assist you?"',
  },
  {
    id: "friendly",
    name: "Friendly",
    description: "Casual, approachable, conversational",
    example: '"Hi there! Thanks for calling. What can I help you with today?"',
  },
  {
    id: "formal",
    name: "Formal",
    description: "Traditional, respectful, structured",
    example:
      '"Thank you for contacting our practice. How may I direct your call?"',
  },
];

const StepPersona = forwardRef(({ config, updateConfig, showErrors }, ref) => {
  const [newKeyword, setNewKeyword] = useState("");
  const persona = config.agent_persona || {};
  const safety = persona.safety_enforcement || {};
  const toneError = !persona.tone_preference
    ? "Please select a conversation tone"
    : null;

  useImperativeHandle(ref, () => ({ validate: () => !toneError }));

  const updatePersona = (updates) => {
    updateConfig({ agent_persona: { ...persona, ...updates } });
  };

  const updateSafety = (updates) => {
    updateConfig({
      agent_persona: {
        ...persona,
        safety_enforcement: { ...safety, ...updates },
      },
    });
  };

  const addKeyword = () => {
    if (newKeyword.trim()) {
      updateSafety({
        emergency_keywords: [
          ...(safety.emergency_keywords || []),
          newKeyword.trim(),
        ],
      });
      setNewKeyword("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tighter text-charcoal">
          Agent Persona & Safety
        </h2>
        <p className="mt-2 text-slate-600">
          Choose how Heidi should sound when interacting with your patients, and
          configure safety protocols.
        </p>
      </div>

      <div>
        <label className="label">Conversation Tone *</label>
        <div
          className={`grid grid-cols-2 gap-3 ${
            showErrors && toneError ? "ring-2 ring-red-300 rounded-xl p-1" : ""
          }`}
        >
          {TONE_OPTIONS.map((tone) => (
            <div
              key={tone.id}
              onClick={() => updatePersona({ tone_preference: tone.id })}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                persona.tone_preference === tone.id
                  ? "border-charcoal bg-charcoal/5"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <h3 className="font-semibold text-charcoal">{tone.name}</h3>
              <p className="text-sm text-slate-500 mt-1">{tone.description}</p>
            </div>
          ))}
        </div>
        {showErrors && toneError && <p className="field-error">{toneError}</p>}
      </div>

      {persona.tone_preference && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-sm font-medium text-slate-500">
            Example greeting:
          </p>
          <p className="text-charcoal italic mt-1">
            {
              TONE_OPTIONS.find((t) => t.id === persona.tone_preference)
                ?.example
            }
          </p>
        </div>
      )}

      <div>
        <label className="label">Handover Phrase</label>
        <input
          type="text"
          value={persona.handover_behavior?.phrase || ""}
          onChange={(e) =>
            updatePersona({
              handover_behavior: {
                ...persona.handover_behavior,
                phrase: e.target.value,
              },
            })
          }
          placeholder="e.g., Let me connect you with our team to help further."
          className="input"
        />
        <p className="text-xs text-slate-500 mt-1">
          What Heidi says when transferring a call to your staff.
        </p>
      </div>

      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-lg font-semibold text-charcoal mb-4">
          🛡️ Safety Settings
        </h3>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={safety.record_calls ?? true}
              onChange={(e) => updateSafety({ record_calls: e.target.checked })}
              className="w-5 h-5 rounded border-slate-300 text-charcoal focus:ring-charcoal"
            />
            <span className="text-slate-600">
              Record calls for quality and safety
            </span>
          </label>

          <div>
            <label className="label">Emergency Action</label>
            <select
              value={safety.emergency_action || "hard_redirect_000"}
              onChange={(e) =>
                updateSafety({ emergency_action: e.target.value })
              }
              className="input"
            >
              <option value="hard_redirect_000">
                Instruct to call 000 (recommended)
              </option>
              <option value="transfer_emergency">
                Transfer to emergency services
              </option>
              <option value="escalate_staff">Escalate to on-call staff</option>
            </select>
          </div>

          <div>
            <label className="label">Emergency Keywords</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(safety.emergency_keywords || []).map((kw, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full"
                >
                  {kw}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add custom keyword..."
                className="input flex-1"
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              />
              <button
                onClick={addKeyword}
                className="btn btn-secondary btn-small"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="font-medium text-amber-800">⚠️ Safety First</p>
        <p className="text-sm text-amber-700 mt-1">
          Heidi will never provide medical advice, diagnose symptoms, or change
          prescriptions. These are always escalated to staff.
        </p>
      </div>
    </div>
  );
});

export default StepPersona;
