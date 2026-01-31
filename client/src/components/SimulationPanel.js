import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MACHINE DEFINITIONS (mirrored from backend)
// ═══════════════════════════════════════════════════════════════════════════════

const INBOUND_STATES = {
  GREETING: "greeting",
  SAFETY_SCAN: "safety_scan",
  IDENTIFY: "identify",
  TRIAGE: "triage",
  APPOINTMENT_FLOW: "appointment_flow",
  CLINICAL_FLOW: "clinical_flow",
  MESSAGE_FLOW: "message_flow",
  TRANSFER_FLOW: "transfer_flow",
  EMERGENCY_EXIT: "emergency_exit",
  SUCCESS_EXIT: "success_exit",
  CONFUSION_EXIT: "confusion_exit",
};

const STATE_LABELS = {
  [INBOUND_STATES.GREETING]: { label: "Welcome", icon: "👋", phase: 1 },
  [INBOUND_STATES.SAFETY_SCAN]: { label: "Safety Check", icon: "🔍", phase: 1 },
  [INBOUND_STATES.IDENTIFY]: { label: "Identity", icon: "🪪", phase: 1 },
  [INBOUND_STATES.TRIAGE]: { label: "Intent", icon: "🎯", phase: 1 },
  [INBOUND_STATES.APPOINTMENT_FLOW]: {
    label: "Appointment",
    icon: "📅",
    phase: 2,
  },
  [INBOUND_STATES.CLINICAL_FLOW]: { label: "Clinical", icon: "🩺", phase: 2 },
  [INBOUND_STATES.MESSAGE_FLOW]: { label: "Message", icon: "📝", phase: 2 },
  [INBOUND_STATES.TRANSFER_FLOW]: { label: "Transfer", icon: "📞", phase: 2 },
  [INBOUND_STATES.EMERGENCY_EXIT]: { label: "Emergency", icon: "🚨", phase: 3 },
  [INBOUND_STATES.SUCCESS_EXIT]: { label: "Complete", icon: "✅", phase: 3 },
  [INBOUND_STATES.CONFUSION_EXIT]: { label: "Escalated", icon: "↗️", phase: 3 },
};

// Outbound state labels for UI
const OUTBOUND_STATE_LABELS = {
  opening: { label: "Opening", icon: "📞", phase: 1 },
  verify_identity: { label: "Verify ID", icon: "🪪", phase: 1 },
  check_side_effects: { label: "Side Effects", icon: "💊", phase: 2 },
  check_adherence: { label: "Adherence", icon: "📋", phase: 2 },
  probe_reason: { label: "Follow-up", icon: "❓", phase: 2 },
  closing: { label: "Closing", icon: "👋", phase: 3 },
  escalated: { label: "Escalated", icon: "🚨", phase: 3 },
  complete: { label: "Complete", icon: "✅", phase: 3 },
};

function SimulationPanel({ config }) {
  const [activeTab, setActiveTab] = useState("inbound");

  // Inbound conversation state (state machine)
  const [conversation, setConversation] = useState(null);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [callTime, setCallTime] = useState("10:00");
  const [callDay, setCallDay] = useState("monday");
  const chatEndRef = useRef(null);

  // Outbound follow-up state (interactive)
  const [outboundConversation, setOutboundConversation] = useState(null);
  const [outboundMessage, setOutboundMessage] = useState("");
  const outboundChatEndRef = useRef(null);

  // Auto-scroll chat for inbound
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.transcript]);

  // Auto-scroll chat for outbound
  useEffect(() => {
    outboundChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [outboundConversation?.transcript]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // INBOUND CALL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════════

  const startInboundCall = async () => {
    setIsLoading(true);
    try {
      // Send day and time explicitly
      const response = await axios.post("/api/simulate/inbound/start", {
        clinicConfig: config,
        callContext: {
          day: callDay,
          time: callTime,
        },
      });
      setConversation(response.data);
    } catch (error) {
      console.error("Error starting call:", error);
      // Fallback to local simulation
      setConversation(initLocalConversation(config, callDay, callTime));
    }
    setIsLoading(false);
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || !conversation || conversation.isComplete)
      return;

    setIsLoading(true);
    const messageToSend = currentMessage;
    setCurrentMessage("");

    try {
      const response = await axios.post("/api/simulate/inbound/message", {
        conversationState: conversation,
        patientMessage: messageToSend,
        clinicConfig: config,
      });
      setConversation(response.data);
    } catch (error) {
      console.error("Error sending message:", error);
    }
    setIsLoading(false);
  };

  const endCall = () => {
    setConversation(null);
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // OUTBOUND FOLLOW-UP HANDLERS (Interactive)
  // ═══════════════════════════════════════════════════════════════════════════════

  const startOutboundCall = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post("/api/simulate/outbound/start", {
        clinicConfig: config,
      });
      setOutboundConversation(response.data);
    } catch (error) {
      console.error("Error starting outbound call:", error);
    }
    setIsLoading(false);
  };

  const sendOutboundMessage = async () => {
    if (
      !outboundMessage.trim() ||
      !outboundConversation ||
      outboundConversation.isComplete
    )
      return;

    setIsLoading(true);
    const messageToSend = outboundMessage;
    setOutboundMessage("");

    try {
      const response = await axios.post("/api/simulate/outbound/message", {
        conversationState: outboundConversation,
        patientMessage: messageToSend,
        clinicConfig: config,
      });
      setOutboundConversation(response.data);
    } catch (error) {
      console.error("Error sending outbound message:", error);
    }
    setIsLoading(false);
  };

  const endOutboundCall = () => {
    setOutboundConversation(null);
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // UI COMPONENTS
  // ═══════════════════════════════════════════════════════════════════════════════

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

  const StateIndicator = ({ state, isActive }) => {
    const stateInfo = STATE_LABELS[state] || {
      label: state,
      icon: "•",
      phase: 0,
    };
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
          isActive ? "bg-charcoal text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        <span>{stateInfo.icon}</span>
        <span>{stateInfo.label}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tighter text-charcoal">
          Configuration Complete!
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
        <TabButton id="followup" icon="📋" label="Outbound Call" />
        <TabButton id="config" icon="⚙️" label="View Config" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* INBOUND CALL SIMULATION (State Machine) */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "inbound" && (
        <div className="space-y-4">
          {!conversation ? (
            // Pre-call setup
            <div className="card space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-charcoal">
                  Start Inbound Call Simulation
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Simulate a real conversation with the AI. The system uses a
                  state machine to handle different call flows (appointments,
                  clinical concerns, messages).
                </p>
              </div>

              {/* State Machine Diagram */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  State Machine Flow
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Phase 1:</span>
                    <StateIndicator state={INBOUND_STATES.GREETING} />
                    <span className="text-slate-300">→</span>
                    <StateIndicator state={INBOUND_STATES.IDENTIFY} />
                    <span className="text-slate-300">→</span>
                    <StateIndicator state={INBOUND_STATES.TRIAGE} />
                  </div>
                  <span className="text-slate-300">→</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Phase 2:</span>
                    <StateIndicator state={INBOUND_STATES.APPOINTMENT_FLOW} />
                    <span className="text-slate-400">/</span>
                    <StateIndicator state={INBOUND_STATES.CLINICAL_FLOW} />
                    <span className="text-slate-400">/</span>
                    <StateIndicator state={INBOUND_STATES.MESSAGE_FLOW} />
                  </div>
                </div>
              </div>

              {/* Call context settings */}
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

              <button
                onClick={startInboundCall}
                disabled={isLoading}
                className="btn btn-primary w-full"
              >
                {isLoading ? "Starting call..." : "📞 Start Call"}
              </button>
            </div>
          ) : (
            // Active conversation
            <div className="card p-0 overflow-hidden">
              {/* Call header */}
              <div className="bg-charcoal text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    📞
                  </div>
                  <div>
                    <div className="font-semibold">Inbound Call</div>
                    <div className="text-sm text-white/70">
                      {conversation.isBusinessHours
                        ? "🟢 Business Hours"
                        : "🔴 After Hours"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StateIndicator state={conversation.currentState} isActive />
                  {conversation.isComplete && (
                    <span className="px-2 py-1 bg-white/20 rounded-full text-xs">
                      {conversation.finalOutcome?.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Chat messages */}
              <div className="h-80 overflow-y-auto p-4 space-y-3 bg-white">
                {conversation.transcript.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-charcoal text-white rounded-br-md"
                          : "bg-sunlight/50 text-charcoal rounded-bl-md"
                      }`}
                    >
                      <div className="text-sm">{msg.content}</div>
                      <div
                        className={`text-xs mt-1 ${
                          msg.role === "user"
                            ? "text-white/50"
                            : "text-charcoal/50"
                        }`}
                      >
                        {msg.role === "user"
                          ? "Patient"
                          : `🤖 Heidi • ${STATE_LABELS[msg.state]?.label || msg.state}`}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-2xl px-4 py-3 rounded-bl-md">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Flags display */}
              {conversation.flags.length > 0 && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
                  <div className="flex flex-wrap gap-2">
                    {conversation.flags.map((flag, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          flag.includes("EMERGENCY") || flag.includes("URGENT")
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

              {/* Input area */}
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                {!conversation.isComplete ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Type patient's response..."
                      className="input flex-1"
                      disabled={isLoading}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={isLoading || !currentMessage.trim()}
                      className="btn btn-primary"
                    >
                      Send
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-sm text-slate-600 mb-3">
                      Call ended:{" "}
                      <strong>
                        {conversation.finalOutcome?.replace(/_/g, " ")}
                      </strong>
                    </div>
                    <button onClick={endCall} className="btn btn-primary">
                      Start New Call
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Patient info (if identified) */}
          {conversation?.patientIdentified && (
            <div className="card bg-emerald-50 border-emerald-200">
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                Patient Identified
              </div>
              <div className="text-sm text-emerald-800">
                <strong>{conversation.patientName}</strong>
                {conversation.patientDob &&
                  ` • DOB: ${conversation.patientDob}`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* OUTBOUND FOLLOW-UP SIMULATION (Interactive) */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "followup" && (
        <div className="space-y-4">
          {!outboundConversation ? (
            /* Pre-call setup */
            <div className="card space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-charcoal">
                  Start Medication Follow-up Call
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Simulate an outbound follow-up call for blood pressure
                  medication (Zestril). Chat interactively as the patient.
                </p>
              </div>

              {/* Context info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800">
                  <strong>Context:</strong> Heidi is calling to check on a
                  patient who was recently prescribed Zestril for blood
                  pressure. She'll ask about side effects, medication adherence,
                  and any concerns.
                </p>
              </div>

              {/* State machine flow */}
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Follow-up Call Flow
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Opening:</span>
                    <span className="px-2 py-1 bg-white rounded-lg text-xs border border-slate-200">
                      📞 Intro
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className="px-2 py-1 bg-white rounded-lg text-xs border border-slate-200">
                      🪪 Verify
                    </span>
                  </div>
                  <span className="text-slate-300">→</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500">Assessment:</span>
                    <span className="px-2 py-1 bg-white rounded-lg text-xs border border-slate-200">
                      💊 Side Effects
                    </span>
                    <span className="text-slate-300">→</span>
                    <span className="px-2 py-1 bg-white rounded-lg text-xs border border-slate-200">
                      📋 Adherence
                    </span>
                  </div>
                  <span className="text-slate-300">→</span>
                  <span className="px-2 py-1 bg-white rounded-lg text-xs border border-slate-200">
                    ✅ Close
                  </span>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                  <strong>💡 Try these scenarios:</strong> Report severe side
                  effects like "I've been very dizzy and almost fainted" to
                  trigger escalation, or say "I missed a few days" to explore
                  the adherence probe flow.
                </p>
              </div>

              <button
                onClick={startOutboundCall}
                disabled={isLoading}
                className="btn btn-primary w-full"
              >
                {isLoading ? "Starting call..." : "📞 Start Call"}
              </button>
            </div>
          ) : (
            /* Active call - Chat interface */
            <div className="card p-0 overflow-hidden">
              {/* Call header */}
              <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    📤
                  </div>
                  <div>
                    <div className="font-semibold">Outbound Follow-up Call</div>
                    <div className="text-sm text-white/70">
                      💊 Medication: Zestril (Blood Pressure)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      outboundConversation.escalatedToDoctor
                        ? "bg-red-500"
                        : "bg-white/20"
                    }`}
                  >
                    {OUTBOUND_STATE_LABELS[outboundConversation.currentState]
                      ?.icon || "💬"}{" "}
                    {OUTBOUND_STATE_LABELS[outboundConversation.currentState]
                      ?.label || outboundConversation.currentState}
                  </span>
                  {outboundConversation.isComplete && (
                    <span className="px-2 py-1 bg-white/20 rounded-full text-xs">
                      {outboundConversation.finalOutcome?.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Chat messages */}
              <div className="h-80 overflow-y-auto p-4 space-y-3 bg-white">
                {outboundConversation.transcript.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-charcoal text-white rounded-br-md"
                          : "bg-blue-100 text-charcoal rounded-bl-md"
                      }`}
                    >
                      <div className="text-sm">{msg.content}</div>
                      <div
                        className={`text-xs mt-1 ${
                          msg.role === "user"
                            ? "text-white/50"
                            : "text-charcoal/50"
                        }`}
                      >
                        {msg.role === "user"
                          ? "Patient"
                          : `🤖 Heidi • ${OUTBOUND_STATE_LABELS[msg.state]?.label || msg.state}`}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 rounded-2xl px-4 py-3 rounded-bl-md">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={outboundChatEndRef} />
              </div>

              {/* Flags display */}
              {outboundConversation.flags.length > 0 && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
                  <div className="flex flex-wrap gap-2">
                    {outboundConversation.flags.map((flag, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 text-xs rounded-full ${
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

              {/* Input area */}
              <div className="p-4 border-t border-slate-200 bg-slate-50">
                {!outboundConversation.isComplete ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={outboundMessage}
                      onChange={(e) => setOutboundMessage(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && sendOutboundMessage()
                      }
                      placeholder="Type patient's response..."
                      className="input flex-1"
                      disabled={isLoading}
                    />
                    <button
                      onClick={sendOutboundMessage}
                      disabled={isLoading || !outboundMessage.trim()}
                      className="btn btn-primary"
                    >
                      Send
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Call Summary */}
                    <div className="text-center">
                      <div className="text-sm text-slate-600 mb-2">
                        Call ended:{" "}
                        <strong>
                          {outboundConversation.finalOutcome?.replace(
                            /_/g,
                            " ",
                          )}
                        </strong>
                      </div>
                    </div>

                    {/* Flags Summary - Prominent Display */}
                    {outboundConversation.flags.length > 0 && (
                      <div className="bg-slate-100 rounded-xl p-4 space-y-3">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          📋 Call Summary - Flags Raised
                        </div>
                        <div className="space-y-2">
                          {outboundConversation.flags.map((flag, i) => (
                            <div
                              key={i}
                              className={`flex items-start gap-2 p-2 rounded-lg ${
                                flag.includes("URGENT")
                                  ? "bg-red-100 border border-red-200"
                                  : flag.includes("reason:")
                                    ? "bg-blue-50 border border-blue-200"
                                    : "bg-amber-50 border border-amber-200"
                              }`}
                            >
                              <span className="text-sm">
                                {flag.includes("URGENT")
                                  ? "🚨"
                                  : flag.includes("reason:")
                                    ? "📝"
                                    : flag.includes("side_effects")
                                      ? "💊"
                                      : flag.includes("adherence")
                                        ? "📋"
                                        : "⚠️"}
                              </span>
                              <span
                                className={`text-sm font-medium ${
                                  flag.includes("URGENT")
                                    ? "text-red-800"
                                    : flag.includes("reason:")
                                      ? "text-blue-800"
                                      : "text-amber-800"
                                }`}
                              >
                                {flag.replace(/_/g, " ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={endOutboundCall}
                      className="btn btn-primary w-full"
                    >
                      Start New Call
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Patient info (if identified) */}
          {outboundConversation?.patientIdentified && (
            <div className="card bg-emerald-50 border-emerald-200">
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                Patient Identified
              </div>
              <div className="text-sm text-emerald-800">
                <strong>{outboundConversation.patientName}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
      {/* CONFIG VIEW */}
      {/* ═══════════════════════════════════════════════════════════════════════════════ */}
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
    </div>
  );
}

// // ═══════════════════════════════════════════════════════════════════════════════
// // LOCAL FALLBACK SIMULATIONS
// // ═══════════════════════════════════════════════════════════════════════════════

// function initLocalConversation(config, day, time) {
//   const schedule = config.operating_hours?.schedule?.[day];
//   const [hour, min] = time.split(":").map(Number);
//   const currentMinutes = hour * 60 + min;

//   let isBusinessHours = false;
//   if (schedule?.is_open) {
//     const [startH, startM] = schedule.start.split(":").map(Number);
//     const [endH, endM] = schedule.end.split(":").map(Number);
//     isBusinessHours =
//       currentMinutes >= startH * 60 + startM &&
//       currentMinutes < endH * 60 + endM;
//   }

//   const clinicName = config.clinic_name || "the clinic";
//   const greeting = isBusinessHours
//     ? `Thanks for calling ${clinicName}. I'm Heidi, the clinic's digital assistant. How can I help you today?`
//     : `Thanks for calling ${clinicName}. I'm Heidi, the clinic's digital assistant. Our clinic is currently closed, but I can take a message or help with urgent care options. How can I help?`;

//   return {
//     conversationId: `local_${Date.now()}`,
//     currentState: INBOUND_STATES.GREETING,
//     isBusinessHours,
//     clinicName,
//     tone: config.agent_persona?.tone_preference || "professional",
//     transcript: [
//       {
//         role: "assistant",
//         content: greeting,
//         state: INBOUND_STATES.GREETING,
//         timestamp: new Date().toISOString(),
//       },
//     ],
//     patientIdentified: false,
//     patientName: null,
//     patientDob: null,
//     intent: null,
//     flags: [],
//     confusionCount: 0,
//     isComplete: false,
//     metadata: {
//       startTime: new Date().toISOString(),
//       callType: "inbound",
//       isLocal: true,
//     },
//   };
// }

// function processLocalMessage(conversation, message, config) {
//   const lowerMessage = message.toLowerCase();
//   const transcript = [...conversation.transcript];
//   let currentState = conversation.currentState;
//   let flags = [...conversation.flags];
//   let patientName = conversation.patientName;
//   let patientDob = conversation.patientDob;
//   let intent = conversation.intent;
//   let isComplete = false;
//   let finalOutcome = null;
//   let aiResponse = "";

//   // Add patient message
//   transcript.push({
//     role: "user",
//     content: message,
//     state: currentState,
//     timestamp: new Date().toISOString(),
//   });

//   // Helper to detect intent from message
//   const detectIntent = (msg) => {
//     const lower = msg.toLowerCase();
//     if (
//       lower.includes("appointment") ||
//       lower.includes("book") ||
//       lower.includes("see dr") ||
//       lower.includes("see doctor")
//     ) {
//       return "appointment";
//     }
//     if (
//       lower.includes("speak") ||
//       lower.includes("talk") ||
//       lower.includes("human") ||
//       lower.includes("receptionist")
//     ) {
//       return "transfer";
//     }
//     if (
//       lower.includes("result") ||
//       lower.includes("form") ||
//       lower.includes("prescription") ||
//       lower.includes("referral")
//     ) {
//       return "admin";
//     }
//     if (
//       lower.includes("pain") ||
//       lower.includes("sick") ||
//       lower.includes("rash") ||
//       lower.includes("symptom") ||
//       lower.includes("headache") ||
//       lower.includes("dizzy")
//     ) {
//       return "clinical";
//     }
//     return null;
//   };

//   // Emergency check - always first
//   const emergencyKeywords = [
//     "chest pain",
//     "can't breathe",
//     "heart attack",
//     "stroke",
//     "emergency",
//     "unconscious",
//   ];
//   if (emergencyKeywords.some((kw) => lowerMessage.includes(kw))) {
//     currentState = INBOUND_STATES.EMERGENCY_EXIT;
//     aiResponse =
//       "This sounds like an emergency. Please hang up and call 000 immediately, or go to your nearest emergency department. Your safety is the priority right now.";
//     flags.push("EMERGENCY_DETECTED");
//     isComplete = true;
//     finalOutcome = "emergency_redirect";
//   } else {
//     switch (currentState) {
//       case INBOUND_STATES.GREETING:
//         // Check if patient stated intent in their first message
//         const earlyIntent = detectIntent(message);

//         if (earlyIntent) {
//           intent = earlyIntent;
//           currentState = INBOUND_STATES.IDENTIFY;
//           const acknowledgments = {
//             appointment:
//               "I can definitely help you with booking an appointment.",
//             clinical: "I understand you have a health concern.",
//             admin: "I can help you with that.",
//             transfer: "I can connect you with our team.",
//           };
//           aiResponse = `${acknowledgments[earlyIntent]} Before I can assist you, I just need to verify your identity. Could you please provide your full name and date of birth?`;
//         } else {
//           currentState = INBOUND_STATES.IDENTIFY;
//           aiResponse =
//             "To get started, could I please have your full name and date of birth?";
//         }
//         break;

//       case INBOUND_STATES.IDENTIFY:
//         // Try to extract name/DOB
//         const nameDobMatch = message.match(
//           /^([A-Z][a-z]+\s+[A-Z][a-z]+),?\s+(.+)$/i,
//         );

//         // Also check if patient is stating intent instead
//         const identifyPhaseIntent = detectIntent(message);

//         if (nameDobMatch) {
//           patientName = nameDobMatch[1];
//           patientDob = nameDobMatch[2];

//           // If we captured intent earlier, go directly to that flow
//           if (intent) {
//             switch (intent) {
//               case "appointment":
//                 currentState = INBOUND_STATES.APPOINTMENT_FLOW;
//                 aiResponse = `Thank you, ${patientName.split(" ")[0]}. I can help you book an appointment. Do you have a preferred doctor, or would you like the next available appointment with any GP?`;
//                 break;
//               case "clinical":
//                 currentState = INBOUND_STATES.MESSAGE_FLOW;
//                 aiResponse = `Thank you, ${patientName.split(" ")[0]}. I'll make sure our clinical team knows about your concern. Can you tell me a bit more about what you're experiencing?`;
//                 flags.push("clinical_concern_logged");
//                 break;
//               case "admin":
//                 currentState = INBOUND_STATES.MESSAGE_FLOW;
//                 aiResponse = `Thank you, ${patientName.split(" ")[0]}. I've noted your request. A staff member will get back to you within 24 hours. Is there anything else?`;
//                 flags.push("admin_request_logged");
//                 break;
//               case "transfer":
//                 currentState = INBOUND_STATES.TRANSFER_FLOW;
//                 if (conversation.isBusinessHours) {
//                   aiResponse = `Thank you, ${patientName.split(" ")[0]}. I'll transfer you to our reception now. Please hold.`;
//                   flags.push("transfer_requested");
//                   isComplete = true;
//                   finalOutcome = "live_transfer";
//                 } else {
//                   aiResponse = `Thank you, ${patientName.split(" ")[0]}. I'm sorry, no one is available right now as we're closed. I can take a message and have someone call you back first thing tomorrow.`;
//                   currentState = INBOUND_STATES.MESSAGE_FLOW;
//                 }
//                 break;
//               default:
//                 currentState = INBOUND_STATES.TRIAGE;
//                 aiResponse = `Thank you, ${patientName.split(" ")[0]}. How can I help you today?`;
//             }
//           } else {
//             currentState = INBOUND_STATES.TRIAGE;
//             aiResponse = `Thank you, ${patientName.split(" ")[0]}. How can I help you today?`;
//           }
//         } else if (identifyPhaseIntent && !intent) {
//           // Patient is stating intent instead of identity - capture it
//           intent = identifyPhaseIntent;
//           const acknowledgments = {
//             appointment: "I'd be happy to help you book an appointment.",
//             clinical: "I understand you have a health concern.",
//             admin: "I can help you with that.",
//             transfer: "I can connect you with our team.",
//           };
//           aiResponse = `${acknowledgments[identifyPhaseIntent]} I just need your name and date of birth first to pull up your records — for example, "John Smith, January 15, 1980".`;
//         } else {
//           aiResponse =
//             "I didn't quite catch that. Could you please tell me your full name and date of birth? For example, 'John Smith, January 15, 1980'.";
//         }
//         break;

//       case INBOUND_STATES.TRIAGE:
//         const triageIntent = detectIntent(message);

//         if (
//           triageIntent === "appointment" ||
//           lowerMessage.includes("appointment") ||
//           lowerMessage.includes("book") ||
//           lowerMessage.includes("see")
//         ) {
//           currentState = INBOUND_STATES.APPOINTMENT_FLOW;
//           aiResponse =
//             "I can help you book an appointment. Do you have a preferred doctor, or would you like the next available appointment with any GP?";
//         } else if (
//           triageIntent === "transfer" ||
//           lowerMessage.includes("speak") ||
//           lowerMessage.includes("talk") ||
//           lowerMessage.includes("human")
//         ) {
//           currentState = INBOUND_STATES.TRANSFER_FLOW;
//           if (conversation.isBusinessHours) {
//             aiResponse = "I'll transfer you to our reception now. Please hold.";
//             flags.push("transfer_requested");
//             isComplete = true;
//             finalOutcome = "live_transfer";
//           } else {
//             aiResponse =
//               "I'm sorry, no one is available right now as we're closed. I can take a message and have someone call you back first thing tomorrow.";
//             currentState = INBOUND_STATES.MESSAGE_FLOW;
//           }
//         } else if (
//           triageIntent === "admin" ||
//           lowerMessage.includes("result") ||
//           lowerMessage.includes("form") ||
//           lowerMessage.includes("prescription")
//         ) {
//           currentState = INBOUND_STATES.MESSAGE_FLOW;
//           aiResponse =
//             "I've noted that down. A staff member will get back to you within 24 hours. Is there anything else?";
//           flags.push("admin_request_logged");
//         } else if (
//           triageIntent === "clinical" ||
//           lowerMessage.includes("pain") ||
//           lowerMessage.includes("sick") ||
//           lowerMessage.includes("rash") ||
//           lowerMessage.includes("symptom")
//         ) {
//           currentState = INBOUND_STATES.MESSAGE_FLOW;
//           aiResponse =
//             "I'll make sure our clinical team knows about this. They'll review it and call you back. Is there anything else you'd like me to note?";
//           flags.push("clinical_concern_logged");
//         } else {
//           aiResponse =
//             "I'm not sure I understood. Would you like to book an appointment, discuss a health concern, or leave a message for the clinic?";
//         }
//         break;

//       case INBOUND_STATES.APPOINTMENT_FLOW:
//         if (
//           lowerMessage.includes("yes") ||
//           lowerMessage.includes("that works") ||
//           lowerMessage.includes("book") ||
//           lowerMessage.includes("perfect") ||
//           lowerMessage.includes("sounds good")
//         ) {
//           currentState = INBOUND_STATES.SUCCESS_EXIT;
//           aiResponse =
//             "Perfect! I've booked that appointment for you. You'll receive a confirmation SMS shortly. Is there anything else I can help with?";
//           flags.push("appointment_booked");
//           isComplete = true;
//           finalOutcome = "appointment_booked";
//         } else {
//           aiResponse =
//             "I have openings tomorrow at 10am or Thursday at 2pm. Would either of those work for you?";
//         }
//         break;

//       case INBOUND_STATES.MESSAGE_FLOW:
//         if (
//           lowerMessage.includes("no") ||
//           lowerMessage.includes("that's all") ||
//           lowerMessage.includes("thanks") ||
//           lowerMessage.includes("goodbye") ||
//           lowerMessage.includes("bye")
//         ) {
//           currentState = INBOUND_STATES.SUCCESS_EXIT;
//           aiResponse =
//             "I've got all of that noted. Someone will be in touch soon. Take care, goodbye!";
//           isComplete = true;
//           finalOutcome = "message_logged";
//         } else {
//           aiResponse =
//             "I've added that to the message. Anything else you'd like me to pass along?";
//         }
//         break;

//       default:
//         aiResponse = "How can I help you further?";
//     }
//   }

//   // Add AI response
//   transcript.push({
//     role: "assistant",
//     content: aiResponse,
//     state: currentState,
//     timestamp: new Date().toISOString(),
//   });

//   return {
//     ...conversation,
//     currentState,
//     transcript,
//     patientIdentified: !!patientName,
//     patientName,
//     patientDob,
//     intent,
//     flags,
//     isComplete,
//     finalOutcome,
//     aiResponse,
//   };
// }

export default SimulationPanel;
