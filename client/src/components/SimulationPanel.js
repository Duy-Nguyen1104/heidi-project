import React, { useState } from "react";
import axios from "axios";

// Outbound follow-up step definitions - only patient responses are configurable
// AI will generate its own responses dynamically based on context
const FOLLOWUP_STEPS = [
  {
    id: "opening",
    label: "Opening",
    instruction:
      "Heidi introduces herself, states the purpose (BP medication follow-up), and asks if it's a good time.",
    placeholder: "e.g., Yes, I can talk now / Not right now",
    defaultResponse: "Yes, I have a few minutes",
  },
  {
    id: "verify_identity",
    label: "Step 1: Verify Identity",
    instruction:
      "Heidi asks the patient to confirm their identity (name and date of birth).",
    placeholder: "e.g., John Smith, January 15, 1965",
    defaultResponse: "John Smith, January 15, 1965",
  },
  {
    id: "side_effects",
    label: "Step 2: Check Side Effects",
    instruction:
      "Heidi asks about any side effects from the Zestril (lightheadedness, dizziness, dry cough, etc).",
    placeholder: "e.g., No, nothing unusual / Yes, I've been very dizzy",
    defaultResponse: "No, nothing unusual",
  },
  {
    id: "adherence",
    label: "Step 3: Check Adherence",
    instruction:
      "Heidi asks if the patient has been taking the medication as prescribed (once daily).",
    placeholder: "e.g., Yes, every day / I missed a couple of days",
    defaultResponse: "I missed a couple of days",
  },
  {
    id: "probe_reason",
    label: "Step 4: Probe Reason (if needed)",
    instruction:
      "If adherence issues, Heidi gently asks why (forgetting, side effects, ran out, etc).",
    placeholder: "e.g., I forgot / Ran out of pills / Side effects bothered me",
    defaultResponse: "I just forgot",
  },
  {
    id: "closing",
    label: "Step 5: Closing & Flagging",
    instruction:
      "Heidi summarizes, sets expectations for follow-up, and asks if there's anything else.",
    placeholder:
      "e.g., No, that's all / Yes, please tell them about my headaches",
    defaultResponse: "No, that's all. Thank you.",
  },
];

function SimulationPanel({ config }) {
  const [activeTab, setActiveTab] = useState("inbound");
  const [simulationResult, setSimulationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Inbound call state
  const [callTime, setCallTime] = useState("10:00");
  const [callDay, setCallDay] = useState("monday");
  const [callerMessage, setCallerMessage] = useState("");

  // Outbound follow-up state - now stores responses for each step
  const [patientResponses, setPatientResponses] = useState(
    FOLLOWUP_STEPS.map((step) => ({ text: step.defaultResponse }))
  );

  const simulateInboundCall = async () => {
    setLoading(true);
    try {
      const dayIndex = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ].indexOf(callDay);
      const today = new Date();
      const diff = dayIndex - today.getDay();
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);
      const [hours, minutes] = callTime.split(":");
      targetDate.setHours(parseInt(hours), parseInt(minutes));

      const response = await axios.post("/api/simulate/inbound", {
        clinicConfig: config,
        callContext: {
          currentTime: targetDate.toISOString(),
          callerIntent: detectIntent(callerMessage),
          callerMessage: callerMessage,
        },
      });
      setSimulationResult({ type: "inbound", data: response.data });
    } catch (error) {
      console.error("Simulation error:", error);
      setSimulationResult({
        type: "inbound",
        data: simulateLocally(config, callDay, callTime, callerMessage),
      });
    }
    setLoading(false);
  };

  const simulateFollowupCall = async () => {
    setLoading(true);
    try {
      const response = await axios.post("/api/simulate/outbound-followup", {
        clinicConfig: config,
        templateId: "medication_followup",
        patientResponses: patientResponses,
      });
      setSimulationResult({ type: "followup", data: response.data });
    } catch (error) {
      console.error("Simulation error:", error);
      setSimulationResult({
        type: "followup",
        data: simulateFollowupLocally(config, patientResponses),
      });
    }
    setLoading(false);
  };

  const detectIntent = (message) => {
    const lower = message.toLowerCase();
    if (lower.includes("book") || lower.includes("appointment"))
      return "book_appointment";
    if (lower.includes("cancel")) return "cancel_appointment";
    if (lower.includes("emergency") || lower.includes("urgent"))
      return "emergency";
    if (lower.includes("speak") || lower.includes("doctor"))
      return "speak_to_human";
    return "general_inquiry";
  };

  const updatePatientResponse = (index, text) => {
    const updated = [...patientResponses];
    updated[index] = { text };
    setPatientResponses(updated);
  };

  const presetScenarios = [
    {
      label: "Book appointment",
      message: "Hi, I'd like to book an appointment with Dr. Smith please",
    },
    {
      label: "Urgent matter",
      message: "I need to speak to a doctor urgently about my test results",
    },
    {
      label: "Leave voicemail",
      message: "Can I leave a message for the doctor?",
    },
    {
      label: "Complaint",
      message:
        "I'm not happy with how my last appointment went, I need to speak to someone",
    },
    {
      label: "Emergency",
      message: "My father is having chest pain and can't breathe properly",
    },
  ];

  const TabButton = ({ id, icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-full transition-all ${
        activeTab === id
          ? "bg-charcoal text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tighter text-charcoal">
          🎯 Configuration Complete!
        </h2>
        <p className="mt-2 text-slate-600">
          Your Heidi Calls agent is configured for{" "}
          <strong className="text-charcoal">
            {config.clinic_name || "your clinic"}
          </strong>
          . Test how it handles different call scenarios below.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-50 rounded-full w-fit">
        <TabButton id="inbound" icon="📞" label="Inbound Call" />
        <TabButton id="followup" icon="📋" label="Medication Follow-up" />
        <TabButton id="config" icon="⚙️" label="View Config" />
      </div>

      {/* Inbound Call Simulation */}
      {activeTab === "inbound" && (
        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-charcoal">
              Simulate Inbound Call
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Test how the AI handles different caller scenarios at different
              times.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Day of Week</label>
              <select
                value={callDay}
                onChange={(e) => setCallDay(e.target.value)}
                className="input"
              >
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
            <div>
              <label className="label">Time</label>
              <input
                type="time"
                value={callTime}
                onChange={(e) => setCallTime(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Caller says:</label>
            <textarea
              rows={3}
              value={callerMessage}
              onChange={(e) => setCallerMessage(e.target.value)}
              placeholder="Type what the caller might say..."
              className="input resize-none"
            />
          </div>

          <div>
            <label className="label">Quick scenarios:</label>
            <div className="flex flex-wrap gap-2">
              {presetScenarios.map((scenario, i) => (
                <button
                  key={i}
                  onClick={() => setCallerMessage(scenario.message)}
                  className="px-3 py-1.5 text-sm bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors"
                >
                  {scenario.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={simulateInboundCall}
            disabled={loading || !callerMessage}
            className="btn btn-primary"
          >
            {loading ? "Simulating..." : "▶ Run Simulation"}
          </button>
        </div>
      )}

      {/* Follow-up Call Simulation */}
      {activeTab === "followup" && (
        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-charcoal">
              Medication Follow-up Simulation
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Configure patient responses below. The AI agent will dynamically
              generate its own dialogue following the conversation structure.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              <strong>Context:</strong> Outbound follow-up call for blood
              pressure medication (Zestril). Heidi will adapt her responses
              based on what the patient says.
            </p>
          </div>

          {/* Follow-up steps - only patient responses are editable */}
          <div className="space-y-3">
            {FOLLOWUP_STEPS.map((step, index) => (
              <div key={step.id} className="bg-slate-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 bg-charcoal text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {index === 0 ? "📞" : index}
                  </span>
                  <span className="font-medium text-charcoal">
                    {step.label}
                  </span>
                </div>

                {/* Step instruction (what AI will do) */}
                <p className="text-xs text-slate-500 mb-2 italic">
                  🤖 {step.instruction}
                </p>

                {/* Patient response input */}
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    👤 Patient responds:
                  </label>
                  <input
                    type="text"
                    value={patientResponses[index]?.text || ""}
                    onChange={(e) =>
                      updatePatientResponse(index, e.target.value)
                    }
                    placeholder={step.placeholder}
                    className="input text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              <strong>💡 Try these scenarios:</strong> Change side effects to
              "Yes, I've been very dizzy and feeling faint" to trigger
              escalation, or set adherence to "Yes, every morning without fail"
              for a positive outcome.
            </p>
          </div>

          <button
            onClick={simulateFollowupCall}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading
              ? "Generating conversation..."
              : "▶ Run Follow-up Simulation"}
          </button>
        </div>
      )}

      {/* Config View */}
      {activeTab === "config" && (
        <div className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-charcoal">
              Generated Configuration
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              This JSON configuration was generated from your onboarding inputs.
            </p>
          </div>
          <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-sm overflow-auto max-h-96 font-mono">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      )}

      {/* Simulation Results */}
      {simulationResult && (
        <div className="card bg-slate-50 border-slate-200">
          <h3 className="text-lg font-semibold text-charcoal mb-4">
            {simulationResult.type === "inbound"
              ? "📞 Inbound Call Result"
              : "📋 Follow-up Call Result"}
          </h3>
          <div className="space-y-3">
            {simulationResult.type === "inbound" ? (
              <InboundResult data={simulationResult.data} />
            ) : (
              <FollowupResult data={simulationResult.data} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InboundResult({ data }) {
  return (
    <>
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Context
        </div>
        <div className="text-sm text-slate-600">
          Time:{" "}
          <span
            className={
              data.isBusinessHours ? "text-emerald-600" : "text-red-500"
            }
          >
            {data.isBusinessHours ? "🟢 Business Hours" : "🔴 After Hours"}
          </span>
          <span className="mx-2">|</span>Classification: {data.classification}
          <span className="mx-2">|</span>Workflow: {data.workflowUsed}
        </div>
      </div>

      {data.steps?.map((step, i) => (
        <div
          key={i}
          className="bg-white rounded-xl p-4 border border-slate-200"
        >
          <div className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
            Step {step.step}: {step.action.replace(/_/g, " ")}
          </div>
          <div className="text-slate-700 bg-sunlight/30 rounded-lg p-3 text-sm">
            <span className="text-slate-500 font-medium">AI:</span> "
            {step.aiResponse}"
          </div>
        </div>
      ))}

      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-1">
          Final Action
        </div>
        <div className="text-amber-600 font-medium">
          {data.finalAction?.replace(/_/g, " ")}
        </div>
      </div>

      {data.flags?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <span className="text-amber-700 font-medium">⚠️ Flags:</span>
          <span className="text-amber-600 ml-2">{data.flags.join(", ")}</span>
        </div>
      )}
    </>
  );
}

function FollowupResult({ data }) {
  const isEscalated = data.escalatedToDoctor || data.urgentCallback;

  return (
    <>
      <div
        className={`rounded-xl p-4 border ${
          isEscalated ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
        }`}
      >
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Template
        </div>
        <div className="text-charcoal font-medium flex items-center gap-2">
          {data.templateUsed}
          {isEscalated && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              ESCALATED
            </span>
          )}
        </div>
      </div>

      {data.steps?.map((step, i) => {
        const isUrgentStep =
          step.outcome?.includes("escalate") ||
          step.outcome?.includes("severe");
        return (
          <div
            key={i}
            className={`rounded-xl p-4 border space-y-2 ${
              isUrgentStep
                ? "bg-red-50 border-red-200"
                : "bg-white border-slate-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-6 h-6 text-xs font-bold rounded-full flex items-center justify-center ${
                  isUrgentStep
                    ? "bg-red-500 text-white"
                    : "bg-charcoal text-white"
                }`}
              >
                {step.stepNumber === 0 ? "📞" : step.stepNumber}
              </span>
              <span className="text-sm font-semibold text-charcoal">
                {step.action.replace(/_/g, " ")}
              </span>
            </div>
            <div
              className={`rounded-lg p-3 text-sm ${
                isUrgentStep ? "bg-red-100" : "bg-sunlight/30"
              }`}
            >
              <span className="text-slate-500 font-medium">🤖 Heidi:</span>
              <span className="text-charcoal ml-1">"{step.aiPrompt}"</span>
            </div>
            {step.patientResponse && (
              <div className="text-slate-600 text-sm pl-3 border-l-2 border-slate-200">
                <span className="font-medium text-slate-500">👤 Patient:</span>{" "}
                "{step.patientResponse}"
              </div>
            )}
            <div
              className={`text-sm ${
                isUrgentStep ? "text-red-600 font-medium" : "text-blue-600"
              }`}
            >
              → {step.outcome?.replace(/_/g, " ")}
            </div>
          </div>
        );
      })}

      <div
        className={`rounded-xl p-4 border ${
          isEscalated
            ? "bg-red-50 border-red-200"
            : "bg-emerald-50 border-emerald-200"
        }`}
      >
        <div className="text-xs font-semibold text-charcoal uppercase tracking-wider mb-2">
          Summary
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-500">Completed:</span>
            <span
              className={`ml-2 font-medium ${
                data.completed ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {data.completed ? "Yes ✓" : "No (Escalated)"}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Clinician Review:</span>
            <span
              className={`ml-2 font-medium ${
                data.requiresClinicianReview
                  ? "text-amber-600"
                  : "text-emerald-600"
              }`}
            >
              {data.requiresClinicianReview ? "Required ⚠️" : "Not needed"}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500">Follow-up:</span>
            <span
              className={`ml-2 font-medium ${
                data.urgentCallback ? "text-red-600" : "text-charcoal"
              }`}
            >
              {data.followupDate}
            </span>
          </div>
        </div>
      </div>

      {data.flags?.length > 0 && (
        <div
          className={`rounded-xl p-4 border ${
            data.urgentCallback
              ? "bg-red-50 border-red-300"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <span
            className={`font-medium ${
              data.urgentCallback ? "text-red-700" : "text-amber-700"
            }`}
          >
            {data.urgentCallback ? "🚨 Urgent Flags:" : "⚠️ Flags:"}
          </span>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.flags.map((flag, i) => (
              <span
                key={i}
                className={`px-2 py-1 text-xs rounded-full ${
                  flag.includes("URGENT")
                    ? "bg-red-200 text-red-800"
                    : "bg-amber-200 text-amber-800"
                }`}
              >
                {flag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Local simulation fallback
function simulateLocally(config, day, time, message) {
  const schedule = config.operating_hours?.schedule?.[day];
  const [hour, min] = time.split(":").map(Number);
  const currentMinutes = hour * 60 + min;

  let isBusinessHours = false;
  if (schedule?.is_open) {
    const [startH, startM] = schedule.start.split(":").map(Number);
    const [endH, endM] = schedule.end.split(":").map(Number);
    isBusinessHours =
      currentMinutes >= startH * 60 + startM &&
      currentMinutes < endH * 60 + endM;
  }

  const lowerMessage = message.toLowerCase();
  const emergencyKeywords =
    config.agent_persona?.safety_enforcement?.emergency_keywords || [];
  const isEmergency = emergencyKeywords.some((k) =>
    lowerMessage.includes(k.toLowerCase())
  );

  const escalationKeywords =
    config.call_classification?.escalation_triggers?.keywords || [];
  const shouldEscalate = escalationKeywords.some((k) =>
    lowerMessage.includes(k.toLowerCase())
  );

  const steps = [];
  let finalAction = "";
  let classification = "general";
  const flags = [];

  if (isEmergency) {
    steps.push({
      step: 1,
      action: "emergency_detected",
      aiResponse:
        "This sounds like an emergency. I'm going to ask you to hang up and call 000 immediately for emergency services.",
    });
    finalAction = "emergency_redirect";
    classification = "emergency";
  } else {
    const tone = config.agent_persona?.tone_preference || "professional";
    const clinicName = config.clinic_name || "the clinic";
    const greetings = {
      empathetic: `Hello, thank you for calling ${clinicName}. I'm here to help you today. How are you doing?`,
      professional: `Good day, you've reached ${clinicName}. How may I assist you?`,
      friendly: `Hi there! Thanks for calling ${clinicName}. What can I help you with today?`,
    };

    steps.push({
      step: 1,
      action: "greeting",
      aiResponse: greetings[tone] || greetings.professional,
    });

    if (shouldEscalate) {
      classification = "escalation";
      if (isBusinessHours) {
        steps.push({
          step: 2,
          action: "escalate_to_staff",
          aiResponse:
            config.agent_persona?.handover_behavior?.phrase ||
            "Let me connect you with our team to help further.",
        });
        finalAction = "live_transfer";
      } else {
        steps.push({
          step: 2,
          action: "take_message",
          aiResponse:
            "I'll make sure our team gets your message and contacts you as soon as possible.",
        });
        finalAction = "message_taken";
        flags.push("urgent_callback_required");
      }
    } else if (
      lowerMessage.includes("appointment") ||
      lowerMessage.includes("book")
    ) {
      steps.push({
        step: 2,
        action: "attempt_resolution",
        aiResponse:
          "I'd be happy to help you book an appointment. Let me check our availability. What day works best for you?",
      });
      finalAction = "appointment_booking_initiated";
    } else if (!isBusinessHours) {
      steps.push({
        step: 2,
        action: "after_hours_message",
        aiResponse:
          "Our clinic is currently closed. I can take a message and someone will get back to you when we reopen.",
      });
      finalAction = "voicemail_recorded";
    } else {
      steps.push({
        step: 2,
        action: "general_assist",
        aiResponse:
          "I'd be happy to help with that. Let me see what I can do for you.",
      });
      finalAction = "assisted";
    }
  }

  return {
    steps,
    finalAction,
    classification,
    isBusinessHours,
    flags,
    workflowUsed: isBusinessHours
      ? "business_hours_logic"
      : "after_hours_logic",
  };
}

function simulateFollowupLocally(config, patientResponses) {
  const clinicName = config.clinic_name || "Northside Medical";
  const tone = config.agent_persona?.tone_preference || "empathetic";
  const steps = [];
  const flags = [];
  let escalateToDoctor = false;

  // Calculate follow-up date
  const followupDate = new Date();
  followupDate.setDate(followupDate.getDate() + 3);
  const dateStr = followupDate.toLocaleDateString("en-AU", {
    month: "long",
    day: "numeric",
  });

  // Helper to vary greetings based on tone
  const getOpeningVariation = () => {
    const variations = {
      empathetic: [
        `Hi there, this is Heidi, your digital care partner calling from ${clinicName}. I hope I'm catching you at an okay time — I'm just reaching out to see how you're getting on with your new blood pressure medication. Would you have a few minutes to chat?`,
        `Hello! This is Heidi from ${clinicName}. I'm calling to check in on how you're doing with your blood pressure medication. Is this a good moment for a quick chat?`,
      ],
      professional: [
        `Good day, this is Heidi, the digital care assistant from ${clinicName}. I'm calling regarding your recent blood pressure medication prescription. Do you have a few minutes to discuss how it's going?`,
        `Hello, this is Heidi calling from ${clinicName}. I'm following up on your blood pressure medication. Is now a convenient time to talk?`,
      ],
      friendly: [
        `Hey there! It's Heidi from ${clinicName}. Just giving you a quick call to see how things are going with your new BP meds. Got a couple minutes?`,
        `Hi! Heidi here from ${clinicName}. Checking in on your blood pressure medication — is now a good time for a quick chat?`,
      ],
    };
    const toneVariations = variations[tone] || variations.empathetic;
    return toneVariations[Math.floor(Math.random() * toneVariations.length)];
  };

  // Step 0: Opening
  const openingPrompt = getOpeningVariation();
  steps.push({
    stepNumber: 0,
    action: "opening",
    aiPrompt: openingPrompt,
    patientResponse: patientResponses[0]?.text || "Yes, I can talk now",
    outcome: "patient_available",
  });

  // Step 1: Verify Identity - vary the phrasing
  const identityVariations = [
    "Perfect! Just to confirm I've got the right person, could you tell me your full name and date of birth?",
    "Great! Before we continue, I just need to verify your identity. Could you share your name and date of birth with me?",
    "Wonderful! For security purposes, may I confirm your name and date of birth please?",
  ];
  const identityPrompt =
    identityVariations[Math.floor(Math.random() * identityVariations.length)];

  steps.push({
    stepNumber: 1,
    action: "verify_identity",
    aiPrompt: identityPrompt,
    patientResponse: patientResponses[1]?.text || "No response",
    outcome: patientResponses[1]?.text
      ? "identity_verified"
      : "verification_failed",
  });

  // Step 2: Check Side Effects
  const sideEffectVariations = [
    "Thank you for confirming that. So, how have you been feeling since starting the Zestril? Any side effects like dizziness, lightheadedness, or a dry cough?",
    "Great, thanks for that. Now I'd like to ask about side effects — have you noticed anything since starting the medication? Some people experience dizziness or a dry cough.",
    "Appreciated. Moving on — have you experienced any side effects from the Zestril? Things like feeling lightheaded, dizzy, or any unusual tiredness?",
  ];
  const sideEffectPrompt =
    sideEffectVariations[
      Math.floor(Math.random() * sideEffectVariations.length)
    ];

  const patientSideEffects = (patientResponses[2]?.text || "").toLowerCase();

  const hasSideEffects =
    patientSideEffects.includes("yes") ||
    patientSideEffects.includes("lightheaded") ||
    patientSideEffects.includes("dizzy") ||
    patientSideEffects.includes("cough") ||
    patientSideEffects.includes("nauseous") ||
    patientSideEffects.includes("tired") ||
    patientSideEffects.includes("headache");

  const severeSideEffects =
    patientSideEffects.includes("very") ||
    patientSideEffects.includes("severe") ||
    patientSideEffects.includes("really bad") ||
    patientSideEffects.includes("can't") ||
    patientSideEffects.includes("faint") ||
    patientSideEffects.includes("falling") ||
    patientSideEffects.includes("chest") ||
    patientSideEffects.includes("breathing") ||
    (patientSideEffects.includes("dizzy") &&
      (patientSideEffects.includes("nauseous") ||
        patientSideEffects.includes("faint")));

  let sideEffectOutcome = "no_issues";
  if (severeSideEffects) {
    sideEffectOutcome = "severe_side_effects_escalate";
    escalateToDoctor = true;
    flags.push("URGENT: severe_side_effects");
  } else if (hasSideEffects) {
    sideEffectOutcome = "mild_side_effects_noted";
    flags.push("side_effects_reported");
  }

  steps.push({
    stepNumber: 2,
    action: "check_side_effects",
    aiPrompt: sideEffectPrompt,
    patientResponse: patientResponses[2]?.text || "No response",
    outcome: sideEffectOutcome,
  });

  // If severe side effects, escalate immediately
  if (escalateToDoctor) {
    const escalationVariations = [
      `I'm really concerned about what you're telling me. These symptoms need to be looked at by your doctor right away. I'm going to mark this as urgent and have someone from our clinical team call you back within the hour. If you feel any worse, please don't hesitate to call 000 or go to the nearest emergency room. What's the best number to reach you?`,
      `That's quite worrying to hear. I think your doctor needs to know about this right away. I'll flag this as urgent and ensure someone from our team calls you back within the next hour. In the meantime, if things get worse, please call 000 immediately. Can I confirm the best number to call you back on?`,
    ];

    steps.push({
      stepNumber: 3,
      action: "escalate_to_clinician",
      aiPrompt:
        escalationVariations[
          Math.floor(Math.random() * escalationVariations.length)
        ],
      patientResponse: "",
      outcome: "urgent_escalation_initiated",
    });

    return {
      templateUsed: "Medication Follow-up (Escalated)",
      steps,
      flags,
      completed: false,
      escalatedToDoctor: true,
      requiresClinicianReview: true,
      urgentCallback: true,
      followupDate: "Within 1 hour (URGENT)",
    };
  }

  // Step 3: Check Adherence
  const adherenceTransition = hasSideEffects
    ? "I've noted that down and will make sure your care team knows. Now, "
    : "That's reassuring to hear. ";

  const adherenceVariations = [
    `${adherenceTransition}have you been able to take the medication as prescribed? That's once daily, usually in the morning.`,
    `${adherenceTransition}how's the routine going — have you been taking it once a day as prescribed?`,
    `${adherenceTransition}are you managing to take the Zestril each morning as your doctor recommended?`,
  ];
  const adherencePrompt =
    adherenceVariations[Math.floor(Math.random() * adherenceVariations.length)];

  const patientAdherence = (patientResponses[3]?.text || "").toLowerCase();
  const hasAdherenceIssue =
    patientAdherence.includes("missed") ||
    patientAdherence.includes("forgot") ||
    patientAdherence.includes("skipped") ||
    patientAdherence.includes("didn't") ||
    patientAdherence.includes("haven't") ||
    patientAdherence.includes("couple of days") ||
    patientAdherence.includes("few days");

  const goodAdherence =
    (patientAdherence.includes("yes") || patientAdherence.includes("yeah")) &&
    (patientAdherence.includes("every") ||
      patientAdherence.includes("daily") ||
      patientAdherence.includes("morning"));

  steps.push({
    stepNumber: 3,
    action: "check_adherence",
    aiPrompt: adherencePrompt,
    patientResponse: patientResponses[3]?.text || "No response",
    outcome: goodAdherence
      ? "good_adherence"
      : hasAdherenceIssue
      ? "adherence_concern"
      : "adherence_unclear",
  });

  // Step 4: Probe Reason (conditional)
  if (hasAdherenceIssue) {
    const probeVariations = [
      "I completely understand — it can take a while to get into a new routine. Would you mind sharing what made it tricky? Was it simply forgetting, or something else like side effects or running out?",
      "That's okay, it happens to a lot of people starting a new medication. Can you tell me a bit about what got in the way? Forgetting, side effects, or something else?",
      "No judgment at all — starting a new medication is an adjustment. What do you think made it difficult? Was it remembering to take it, or perhaps something else?",
    ];
    const probePrompt =
      probeVariations[Math.floor(Math.random() * probeVariations.length)];

    steps.push({
      stepNumber: 4,
      action: "probe_reason",
      aiPrompt: probePrompt,
      patientResponse: patientResponses[4]?.text || "No response",
      outcome: "reason_identified",
    });
    flags.push("adherence_issue_identified");
  }

  // Step 5: Closing
  let closingPrompt;
  if (flags.length === 0) {
    const positiveClosings = [
      "That's wonderful to hear! It really sounds like you're managing well with the medication. I'll make a note of that for your records. Our team will check in with you again in a few weeks. Take care!",
      "Fantastic! It sounds like everything is going smoothly. I'll let your care team know you're doing well. We'll touch base again in a few weeks. Have a great day!",
    ];
    closingPrompt =
      positiveClosings[Math.floor(Math.random() * positiveClosings.length)];
  } else if (hasAdherenceIssue) {
    const adherenceClosings = [
      `I really appreciate you being open about that. I'll share this with your care team so they can help you figure out a routine that works better for you. Someone will reach out by ${dateStr}. Before I go — is there anything else you'd like me to pass along to them?`,
      `Thanks so much for sharing that with me. Your care team will want to help you find a system that works. Expect a call by ${dateStr}. Is there anything else on your mind I should mention to them?`,
    ];
    closingPrompt =
      adherenceClosings[Math.floor(Math.random() * adherenceClosings.length)];
  } else {
    const generalClosings = [
      `Thank you for taking the time to chat today. I'll pass all of this along to your care team. Someone will be in touch by ${dateStr} to follow up. Is there anything else you'd like me to note down?`,
      `I appreciate you sharing all that. I'll make sure your clinician gets this information. You can expect to hear from someone by ${dateStr}. Anything else I can help with?`,
    ];
    closingPrompt =
      generalClosings[Math.floor(Math.random() * generalClosings.length)];
  }

  steps.push({
    stepNumber: hasAdherenceIssue ? 5 : 4,
    action: "closing",
    aiPrompt: closingPrompt,
    patientResponse: patientResponses[5]?.text || "",
    outcome: "call_completed",
  });

  if (flags.length > 0) {
    flags.push("requires_clinician_review");
  }

  return {
    templateUsed: "Medication Follow-up",
    steps,
    flags,
    completed: true,
    escalatedToDoctor: false,
    requiresClinicianReview: flags.length > 0,
    followupDate: dateStr,
  };
}

export default SimulationPanel;
