/**
 * Call Simulator Service
 *
 * Simulates call handling behavior based on clinic configuration.
 * Uses models in LM Studio for generating responses and analyzing sentiment.
 *
 * INBOUND CALL STATE MACHINE:
 * - Treats conversations as a series of stages the AI must complete
 * - Patient-driven: AI responds based on patient input, not linear script
 * - Safety-first: Emergency detection before identity verification
 */

const AIService = require("./AIService");

// ═══════════════════════════════════════════════════════════════════════════════
// INBOUND CALL STATE MACHINE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * State Machine States for Inbound Calls
 * Each state has specific entry conditions, actions, and exit transitions
 */
const INBOUND_STATES = {
  // Phase 1: Safe-Start (Mandatory)
  GREETING: "greeting",
  SAFETY_SCAN: "safety_scan",
  IDENTIFY: "identify",
  TRIAGE: "triage",

  // Phase 2: Router Paths
  APPOINTMENT_FLOW: "appointment_flow",
  CLINICAL_FLOW: "clinical_flow",
  MESSAGE_FLOW: "message_flow",
  TRANSFER_FLOW: "transfer_flow",

  // Phase 3: Exit Nodes
  EMERGENCY_EXIT: "emergency_exit",
  SUCCESS_EXIT: "success_exit",
  CONFUSION_EXIT: "confusion_exit",

  // Sub-states for flows
  APPOINTMENT_CHECK_ELIGIBILITY: "appointment_check_eligibility",
  APPOINTMENT_OFFER_SLOTS: "appointment_offer_slots",
  APPOINTMENT_CONFIRM: "appointment_confirm",
  CLINICAL_GATHER_SYMPTOMS: "clinical_gather_symptoms",
  CLINICAL_ASSESS_URGENCY: "clinical_assess_urgency",
  MESSAGE_TAKE_DETAILS: "message_take_details",
  MESSAGE_CONFIRM: "message_confirm",
};

/**
 * State Machine States for Outbound Follow-up Calls
 */
const OUTBOUND_STATES = {
  OPENING: "opening",
  VERIFY_IDENTITY: "verify_identity",
  CHECK_SIDE_EFFECTS: "check_side_effects",
  CHECK_ADHERENCE: "check_adherence",
  PROBE_REASON: "probe_reason",
  CLOSING: "closing",
  ESCALATED: "escalated",
  COMPLETE: "complete",
};

/**
 * Intent Categories for routing
 */
const INTENT_CATEGORIES = {
  APPOINTMENT: [
    "book",
    "appointment",
    "schedule",
    "see doctor",
    "available",
    "slot",
    "opening",
  ],
  CLINICAL: [
    "symptom",
    "pain",
    "sick",
    "rash",
    "headache",
    "fever",
    "cough",
    "hurt",
    "bleeding",
    "dizzy",
    "nausea",
    "vomit",
  ],
  ADMIN: [
    "form",
    "results",
    "prescription",
    "referral",
    "letter",
    "document",
    "paperwork",
    "records",
    "test results",
  ],
  TRANSFER: [
    "speak to someone",
    "talk to a person",
    "real person",
    "human",
    "receptionist",
    "staff",
    "manager",
  ],
  EMERGENCY: [
    "chest pain",
    "chest ache",
    "ache in my chest",
    "pain in my chest",
    "pain in chest",
    "hurts in my chest",
    "can't breathe",
    "cannot breathe",
    "struggling to breathe",
    "hard to breathe",
    "difficulty breathing",
    "trouble breathing",
    "heart attack",
    "having a heart",
    "stroke",
    "having a stroke",
    "unconscious",
    "passed out",
    "severe bleeding",
    "bleeding heavily",
    "won't stop bleeding",
    "overdose",
    "took too many",
    "suicide",
    "kill myself",
    "want to die",
    "end my life",
    "emergency",
    "dying",
    "think i'm dying",
    "call ambulance",
    "call 000",
    "need ambulance",
  ],
};

/**
 * State Transition Rules
 * Maps current state + input to next state
 */
const STATE_TRANSITIONS = {
  [INBOUND_STATES.GREETING]: {
    default: INBOUND_STATES.SAFETY_SCAN,
  },
  [INBOUND_STATES.SAFETY_SCAN]: {
    emergency: INBOUND_STATES.EMERGENCY_EXIT,
    safe: INBOUND_STATES.IDENTIFY,
  },
  [INBOUND_STATES.IDENTIFY]: {
    verified: INBOUND_STATES.TRIAGE,
    refused: INBOUND_STATES.MESSAGE_FLOW, // Can still take message without ID
    confusion: INBOUND_STATES.CONFUSION_EXIT,
  },
  [INBOUND_STATES.TRIAGE]: {
    appointment: INBOUND_STATES.APPOINTMENT_FLOW,
    clinical: INBOUND_STATES.CLINICAL_FLOW,
    admin: INBOUND_STATES.MESSAGE_FLOW,
    transfer: INBOUND_STATES.TRANSFER_FLOW,
    unclear: INBOUND_STATES.TRIAGE, // Re-ask with clarification
    confusion: INBOUND_STATES.CONFUSION_EXIT,
  },
  [INBOUND_STATES.APPOINTMENT_FLOW]: {
    eligible: INBOUND_STATES.APPOINTMENT_OFFER_SLOTS,
    not_eligible: INBOUND_STATES.APPOINTMENT_CHECK_ELIGIBILITY,
    success: INBOUND_STATES.SUCCESS_EXIT,
    transfer: INBOUND_STATES.TRANSFER_FLOW,
  },
  [INBOUND_STATES.CLINICAL_FLOW]: {
    emergency: INBOUND_STATES.EMERGENCY_EXIT,
    urgent: INBOUND_STATES.TRANSFER_FLOW,
    non_urgent: INBOUND_STATES.MESSAGE_FLOW,
  },
  [INBOUND_STATES.MESSAGE_FLOW]: {
    complete: INBOUND_STATES.SUCCESS_EXIT,
  },
  [INBOUND_STATES.TRANSFER_FLOW]: {
    transferred: INBOUND_STATES.SUCCESS_EXIT,
    after_hours: INBOUND_STATES.MESSAGE_FLOW,
  },
};

class CallSimulator {
  constructor() {
    this.aiService = new AIService();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATE MACHINE INBOUND CALL SIMULATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Initialize a new inbound call conversation
   * Returns the initial state and greeting
   */
  async initInboundConversation(clinicConfig, callContext) {
    // Use explicit day/time format
    const { day, time } = callContext;
    // Default to current day/time if not provided
    const now = new Date();
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const effectiveDay = day || days[now.getDay()];
    const effectiveTime =
      time ||
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const isBusinessHours = this._isBusinessHours(
      clinicConfig,
      effectiveDay,
      effectiveTime,
    );
    const clinicName = clinicConfig.clinic_name || "the clinic";
    const tone = clinicConfig.agent_persona?.tone_preference || "professional";

    // Define fallback greetings
    const openGreeting = `Thanks for calling ${clinicName}. I'm Heidi, the clinic's digital assistant. How can I help you today?`;
    const closedGreeting = `Thanks for calling ${clinicName}. I'm Heidi, the clinic's digital assistant. Our clinic is currently closed, but I can take a message or help with urgent care options. How can I help?`;

    // Generate greeting based on business hours
    const greetingResponse = await this.aiService.generateResponse(
      "Generate opening greeting",
      {
        clinicConfig,
        isBusinessHours,
        instruction: isBusinessHours
          ? `You are Heidi, the digital assistant for ${clinicName}. The clinic is OPEN right now. Greet the caller warmly. Use a ${tone} tone. Keep it brief - just introduce yourself and ask how you can help. DO NOT mention that the clinic is closed because it is NOT closed.`
          : `You are Heidi, the digital assistant for ${clinicName}. The clinic is currently CLOSED. Greet the caller, mention the clinic is closed, and say you can still help with messages or check for urgent care options. Use a ${tone} tone.`,
      },
    );

    // Use AI response, but fall back if it incorrectly mentions closed/open status
    let greeting = greetingResponse.text;
    if (!greeting) {
      greeting = isBusinessHours ? openGreeting : closedGreeting;
    } else if (
      isBusinessHours &&
      (greeting.toLowerCase().includes("closed") ||
        greeting.toLowerCase().includes("after hours"))
    ) {
      // AI incorrectly said closed when we're open - use fallback
      greeting = openGreeting;
    } else if (!isBusinessHours && !greeting.toLowerCase().includes("closed")) {
      // AI didn't mention closed when we're after hours - use fallback
      greeting = closedGreeting;
    }

    return {
      conversationId: `conv_${Date.now()}`,
      currentState: INBOUND_STATES.GREETING,
      isBusinessHours,
      clinicName,
      tone,
      transcript: [
        {
          role: "assistant",
          content: greeting,
          state: INBOUND_STATES.GREETING,
          timestamp: new Date().toISOString(),
        },
      ],
      patientIdentified: false,
      patientName: null,
      patientDob: null,
      intent: null,
      flags: [],
      confusionCount: 0,
      metadata: {
        startTime: new Date().toISOString(),
        callType: "inbound",
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // STATE MACHINE OUTBOUND CALL SIMULATION (Interactive)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Initialize a new outbound follow-up conversation
   * Returns the initial state and opening message
   */
  async initOutboundConversation(clinicConfig) {
    const clinicName = clinicConfig.clinic_name || "Northside Medical";
    const tone = clinicConfig.agent_persona?.tone_preference || "empathetic";

    // Calculate follow-up date
    const followupDate = this._calculateFollowupDate(
      clinicConfig.defaults?.followup_days || 3,
    );

    // Build base context for AI
    const baseContext = {
      clinicName,
      tone,
      medication: "Zestril (blood pressure medication)",
      callType: "outbound_followup",
    };

    // Generate opening message
    const openingResponse = await this.aiService.generateFollowupResponse({
      ...baseContext,
      step: "opening",
      instruction:
        "Introduce yourself as Heidi, the digital care partner. State you're calling from the clinic about their blood pressure medication follow-up. Mention you'll share their responses with their clinician. Ask if it's a good time to chat for a few minutes. Be warm but professional.",
      conversationHistory: [],
    });

    const openingMessage =
      openingResponse.text ||
      `Hi there, this is Heidi, your digital care partner calling from ${clinicName}. I'm reaching out to check in on how you're doing with your new blood pressure medication. Is now a good time for a quick chat?`;

    return {
      conversationId: `outbound_${Date.now()}`,
      currentState: OUTBOUND_STATES.OPENING,
      clinicName,
      tone,
      followupDate,
      transcript: [
        {
          role: "assistant",
          content: openingMessage,
          state: OUTBOUND_STATES.OPENING,
          timestamp: new Date().toISOString(),
        },
      ],
      patientIdentified: false,
      patientName: null,
      flags: [],
      isComplete: false,
      escalatedToDoctor: false,
      metadata: {
        startTime: new Date().toISOString(),
        callType: "outbound_followup",
        medication: "Zestril",
      },
    };
  }

  /**
   * Process a patient message in an outbound follow-up call
   * Advances through the follow-up steps based on patient responses
   */
  async processOutboundMessage(
    conversationState,
    patientMessage,
    clinicConfig,
  ) {
    const { currentState, clinicName, tone, transcript, flags, followupDate } =
      conversationState;

    // Add patient message to transcript
    transcript.push({
      role: "user",
      content: patientMessage,
      state: currentState,
      timestamp: new Date().toISOString(),
    });

    const baseContext = {
      clinicName,
      tone,
      medication: "Zestril (blood pressure medication)",
      callType: "outbound_followup",
    };

    const conversationHistory = transcript.map((t) => ({
      role: t.role,
      content: t.content,
    }));

    let nextState = currentState;
    let aiResponse = "";
    let newFlags = [...flags];
    let isComplete = false;
    let escalatedToDoctor = conversationState.escalatedToDoctor || false;
    let patientName = conversationState.patientName;
    let patientIdentified = conversationState.patientIdentified;
    const lowerMessage = patientMessage.toLowerCase();

    switch (currentState) {
      case OUTBOUND_STATES.OPENING: {
        // Patient confirmed they can talk, move to identity verification
        nextState = OUTBOUND_STATES.VERIFY_IDENTITY;
        const response = await this.aiService.generateFollowupResponse({
          ...baseContext,
          step: "verify_identity",
          instruction:
            "Transition naturally from the opening. Ask the patient to confirm their name and date of birth so you know you're speaking to the right person. Keep it conversational.",
          conversationHistory,
        });
        aiResponse =
          response.text ||
          "Wonderful! Just to make sure I've got the right person, could you confirm your name and date of birth for me?";
        break;
      }

      case OUTBOUND_STATES.VERIFY_IDENTITY: {
        // Extract identity from response
        const identity = await this._extractIdentity(patientMessage);
        if (identity.name) {
          patientName = identity.name;
          patientIdentified = true;
        }

        nextState = OUTBOUND_STATES.CHECK_SIDE_EFFECTS;
        const response = await this.aiService.generateFollowupResponse({
          ...baseContext,
          step: "check_side_effects",
          instruction:
            "Thank them for confirming their identity. Now ask about any side effects since starting Zestril. Mention common ones like lightheadedness, dizziness, or dry cough. Show genuine concern.",
          conversationHistory,
        });
        aiResponse =
          response.text ||
          "Thanks for confirming. Now, have you noticed any side effects since you started taking the Zestril? Some people experience things like feeling lightheaded, dizzy, or a dry cough.";
        break;
      }

      case OUTBOUND_STATES.CHECK_SIDE_EFFECTS: {
        // Use AI to analyze side effects from patient's response
        const sideEffectAnalysis =
          await this._analyzeSideEffects(patientMessage);
        const { hasSideEffects, severeSideEffects, reportedSymptoms } =
          sideEffectAnalysis;

        if (severeSideEffects) {
          // Escalate immediately
          newFlags.push("URGENT: severe_side_effects");
          escalatedToDoctor = true;
          nextState = OUTBOUND_STATES.ESCALATED;
          const response = await this.aiService.generateFollowupResponse({
            ...baseContext,
            step: "escalate",
            instruction: `The patient reported severe side effects: "${patientMessage}". Express genuine concern. Tell them this needs immediate attention from their doctor. Say you'll flag this as urgent and have clinical staff call back within the hour. Advise them to call 000 or go to emergency if symptoms worsen. Ask if there's anything else they want to tell the doctor.`,
            conversationHistory,
            urgent: true,
          });
          aiResponse =
            response.text ||
            "I'm quite concerned about what you're describing. These symptoms really need attention from your doctor right away. I'm going to flag this as urgent and have someone from our clinical team call you back within the hour. In the meantime, if you feel worse or have any trouble breathing, please call 000 or head to your nearest emergency department. Is there anything else you'd like me to pass on to the doctor?";
        } else {
          if (hasSideEffects) {
            newFlags.push("side_effects_reported");
          }
          nextState = OUTBOUND_STATES.CHECK_ADHERENCE;
          const response = await this.aiService.generateFollowupResponse({
            ...baseContext,
            step: "check_adherence",
            instruction: hasSideEffects
              ? "Acknowledge the side effects they mentioned and reassure them these can be common. Then ask if they've been able to take the medication as prescribed - once daily. Keep it warm and non-judgmental."
              : "Great that they haven't had side effects. Now ask if they've been able to take the medication as prescribed - once daily. Keep it warm and non-judgmental.",
            conversationHistory,
          });
          aiResponse =
            response.text ||
            "Good to know. Now, have you been able to take the medication as your doctor prescribed - once a day?";
        }
        break;
      }

      case OUTBOUND_STATES.CHECK_ADHERENCE: {
        // Use AI to analyze medication adherence from patient's response
        const adherenceAnalysis = await this._analyzeAdherence(patientMessage);
        const { goodAdherence, poorAdherence, adherenceDetails } =
          adherenceAnalysis;

        if (poorAdherence) {
          newFlags.push("adherence_issue");
          nextState = OUTBOUND_STATES.PROBE_REASON;
          const response = await this.aiService.generateFollowupResponse({
            ...baseContext,
            step: "probe_reason",
            instruction:
              "The patient indicated they haven't been taking the medication consistently. Gently and without judgment, ask what made it difficult - was it forgetting, side effects, running out of pills, or something else? Show understanding.",
            conversationHistory,
          });
          aiResponse =
            response.text ||
            "I understand - it can be tricky to keep up with a new routine. Can you tell me a bit more about what made it difficult? Was it forgetting, side effects bothering you, or something else?";
        } else {
          // Good adherence, skip to closing
          nextState = OUTBOUND_STATES.CLOSING;
          const response = await this.aiService.generateFollowupResponse({
            ...baseContext,
            step: "closing",
            instruction: `Great news that they're taking the medication regularly. Summarize the call positively - they're doing well with the medication. Let them know you'll pass this along to their care team who will check in again. The follow-up date is ${followupDate}. Ask if there's anything else they'd like to mention or any questions.`,
            conversationHistory,
          });
          aiResponse =
            response.text ||
            `That's wonderful to hear! It sounds like you're managing really well with the medication. I'll pass this along to your care team - they'll check in again around ${followupDate}. Is there anything else you'd like me to let them know, or any questions?`;
        }
        break;
      }

      case OUTBOUND_STATES.PROBE_REASON: {
        // Use AI to analyze the reason for non-adherence
        const reasonAnalysis =
          await this._analyzeNonAdherenceReason(patientMessage);
        newFlags.push(`reason: ${reasonAnalysis.reason}`);
        if (reasonAnalysis.details) {
          newFlags.push(`reason_details: ${reasonAnalysis.details}`);
        }

        nextState = OUTBOUND_STATES.CLOSING;
        const response = await this.aiService.generateFollowupResponse({
          ...baseContext,
          step: "closing",
          instruction: `Thank them for being honest about the adherence challenges. Based on what they said: "${patientMessage}", provide a supportive response. Let them know you'll pass this information to their care team so they can help. Mention the follow-up date is ${followupDate}. Ask if there's anything else they'd like to mention.`,
          conversationHistory,
        });
        aiResponse =
          response.text ||
          `Thank you for sharing that - it's really helpful to know. I'll make sure to pass this along to your care team so they can support you better. They'll be in touch around ${followupDate}. Is there anything else you'd like me to let them know?`;
        break;
      }

      case OUTBOUND_STATES.ESCALATED: {
        // After escalation, just wrap up
        nextState = OUTBOUND_STATES.COMPLETE;
        isComplete = true;
        const response = await this.aiService.generateFollowupResponse({
          ...baseContext,
          step: "escalation_closing",
          instruction:
            "Wrap up after the escalation. Confirm that you've noted everything and the clinical team will call back urgently. Remind them to seek emergency care if symptoms worsen. Say goodbye warmly but with appropriate concern.",
          conversationHistory,
        });
        aiResponse =
          response.text ||
          "I've noted all of that down and flagged it as urgent. Our clinical team will be in touch very soon. Please don't hesitate to call 000 or go to emergency if you feel worse. Take care of yourself.";
        break;
      }

      case OUTBOUND_STATES.CLOSING: {
        // Check if they're done or have more to say
        const isDone =
          lowerMessage.includes("no") ||
          lowerMessage.includes("that's all") ||
          lowerMessage.includes("nothing") ||
          lowerMessage.includes("thank") ||
          lowerMessage.includes("bye") ||
          lowerMessage.includes("good");

        if (isDone) {
          nextState = OUTBOUND_STATES.COMPLETE;
          isComplete = true;
          const response = await this.aiService.generateFollowupResponse({
            ...baseContext,
            step: "goodbye",
            instruction:
              "The patient has nothing more to add. Thank them warmly for their time and for sharing. Wish them well and say goodbye. Keep it warm and caring.",
            conversationHistory,
          });
          aiResponse =
            response.text ||
            "Thank you so much for taking the time to chat with me today. Take care of yourself, and we'll be in touch soon. Goodbye!";
        } else {
          // They have more to share, note it and then close
          newFlags.push(`additional_note: ${patientMessage}`);
          nextState = OUTBOUND_STATES.COMPLETE;
          isComplete = true;
          const response = await this.aiService.generateFollowupResponse({
            ...baseContext,
            step: "final_note",
            instruction: `The patient shared additional information: "${patientMessage}". Acknowledge what they said, confirm you'll pass it along to the care team, and close the call warmly.`,
            conversationHistory,
          });
          aiResponse =
            response.text ||
            "Thank you for sharing that - I'll make sure to include it in my notes for the care team. They'll follow up with you soon. Take care, and goodbye!";
        }
        break;
      }

      default:
        // Conversation is complete
        aiResponse =
          "Thank you for your time today. Take care, and we'll be in touch soon. Goodbye!";
        isComplete = true;
    }

    // Add AI response to transcript
    transcript.push({
      role: "assistant",
      content: aiResponse,
      state: nextState,
      timestamp: new Date().toISOString(),
    });

    return {
      ...conversationState,
      currentState: nextState,
      transcript,
      patientIdentified,
      patientName,
      flags: newFlags,
      isComplete,
      escalatedToDoctor,
      aiResponse,
      finalOutcome: isComplete
        ? escalatedToDoctor
          ? "escalated_to_clinician"
          : newFlags.length > 0
            ? "completed_with_flags"
            : "completed_successfully"
        : null,
    };
  }

  /**
   * Process a patient message and advance the state machine
   * This is the core conversation handler
   */
  async processInboundMessage(conversationState, patientMessage, clinicConfig) {
    const {
      currentState,
      isBusinessHours,
      clinicName,
      tone,
      transcript,
      patientIdentified,
      confusionCount,
    } = conversationState;

    // Add patient message to transcript
    transcript.push({
      role: "user",
      content: patientMessage,
      state: currentState,
      timestamp: new Date().toISOString(),
    });

    let nextState = currentState;
    let aiResponse = "";
    let flags = [...conversationState.flags];
    let newConfusionCount = confusionCount;
    let patientName = conversationState.patientName;
    let patientDob = conversationState.patientDob;
    let intent = conversationState.intent;
    let isComplete = false;
    let finalOutcome = null;

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1: SAFE-START PROCESSING
    // ─────────────────────────────────────────────────────────────────────────

    // ALWAYS check for emergency first, regardless of current state
    if (this._detectEmergency(patientMessage, clinicConfig)) {
      nextState = INBOUND_STATES.EMERGENCY_EXIT;
      aiResponse = await this._generateEmergencyResponse(clinicConfig);
      flags.push("EMERGENCY_DETECTED");
      isComplete = true;
      finalOutcome = "emergency_redirect";

      transcript.push({
        role: "assistant",
        content: aiResponse,
        state: nextState,
        timestamp: new Date().toISOString(),
      });

      return {
        ...conversationState,
        currentState: nextState,
        transcript,
        flags,
        isComplete,
        finalOutcome,
        aiResponse,
      };
    }

    // Check for transfer/staff request - escalate immediately like emergency
    // Uses escalation_triggers from clinic config if configured
    if (this._detectTransferRequest(patientMessage, clinicConfig)) {
      nextState = INBOUND_STATES.TRANSFER_FLOW;
      aiResponse = await this._generateTransferResponse(
        clinicConfig,
        isBusinessHours,
      );
      flags.push("TRANSFER_REQUESTED");
      isComplete = true;
      finalOutcome = isBusinessHours ? "live_transfer" : "message_for_callback";

      transcript.push({
        role: "assistant",
        content: aiResponse,
        state: nextState,
        timestamp: new Date().toISOString(),
      });

      return {
        ...conversationState,
        currentState: nextState,
        transcript,
        flags,
        isComplete,
        finalOutcome,
        aiResponse,
      };
    }

    // Process based on current state
    switch (currentState) {
      case INBOUND_STATES.GREETING:
        // Check if patient already stated their intent in first message
        const earlyIntent = this._classifyIntent(patientMessage);

        if (earlyIntent !== "unclear") {
          // Patient stated intent - acknowledge it and ask for identity
          intent = earlyIntent;
          nextState = INBOUND_STATES.IDENTIFY;

          // Try AI-generated response with configured tone
          try {
            const aiGeneratedResponse = await this._generateResponse(
              clinicConfig,
              {
                instruction: `The patient wants to ${earlyIntent === "appointment" ? "book an appointment" : earlyIntent === "clinical" ? "discuss a health concern" : earlyIntent === "admin" ? "handle an admin request" : "speak with someone"}. Respond in a ${tone} tone. Acknowledge their request warmly in one sentence, then ask for their full name and date of birth to verify their identity. Keep the response to 2 sentences maximum. Do NOT re-introduce yourself`,
                tone,
                isBusinessHours,
              },
            );

            // Validate AI response - must ask for identity and not re-introduce
            const lowerResponse = aiGeneratedResponse.toLowerCase();
            const isValidResponse =
              (lowerResponse.includes("name") ||
                lowerResponse.includes("identity") ||
                lowerResponse.includes("birth") ||
                lowerResponse.includes("dob")) &&
              !lowerResponse.includes("this is the") &&
              !lowerResponse.includes("welcome to") &&
              !lowerResponse.includes("thank you for calling") &&
              !lowerResponse.includes("how may i") &&
              !lowerResponse.includes("closed");

            aiResponse = isValidResponse
              ? aiGeneratedResponse
              : fallbackResponses[earlyIntent];
          } catch (error) {
            aiResponse = fallbackResponses[earlyIntent];
          }
        } else {
          // No clear intent - just ask for identity
          nextState = INBOUND_STATES.IDENTIFY;
          try {
            const aiGeneratedResponse = await this._generateResponse(
              clinicConfig,
              {
                instruction: `Ask the patient for their full name and date of birth to verify their identity. Use a ${tone} tone. Keep it to one sentence. Do NOT re-introduce yourself.`,
                tone,
                isBusinessHours,
              },
            );
            const lowerResponse = aiGeneratedResponse.toLowerCase();
            const isValidResponse =
              (lowerResponse.includes("name") ||
                lowerResponse.includes("birth") ||
                lowerResponse.includes("dob")) &&
              !lowerResponse.includes("this is") &&
              !lowerResponse.includes("welcome");
            aiResponse = isValidResponse
              ? aiGeneratedResponse
              : "To get started, could I please have your full name and date of birth?";
          } catch (error) {
            aiResponse =
              "To get started, could I please have your full name and date of birth?";
          }
        }
        break;

      case INBOUND_STATES.IDENTIFY:
        // Try to extract name and DOB from response using LLM
        const identityInfo = await this._extractIdentity(patientMessage);

        // Also check if patient is stating their intent instead of providing identity
        const identifyPhaseIntent = this._classifyIntent(patientMessage);

        if (identityInfo.name && identityInfo.dob) {
          patientName = identityInfo.name;
          patientDob = identityInfo.dob;

          // If we already captured intent earlier, go directly to that flow
          if (intent && intent !== "unclear") {
            switch (intent) {
              case "appointment":
                nextState = INBOUND_STATES.APPOINTMENT_FLOW;
                aiResponse = await this._handleAppointmentFlow(
                  `I want to book an appointment`,
                  clinicConfig,
                  patientName,
                  isBusinessHours,
                );
                break;
              case "clinical":
                nextState = INBOUND_STATES.CLINICAL_FLOW;
                const clinicalResult = await this._handleClinicalFlow(
                  conversationState.pendingClinicalMessage || "health concern",
                  clinicConfig,
                  isBusinessHours,
                  patientName,
                );
                aiResponse = clinicalResult.response;
                if (clinicalResult.urgent) {
                  flags.push("clinical_concern_urgent");
                  nextState = INBOUND_STATES.TRANSFER_FLOW;
                } else {
                  nextState = INBOUND_STATES.MESSAGE_FLOW;
                  flags.push("clinical_concern_logged");
                }
                break;
              case "admin":
                nextState = INBOUND_STATES.MESSAGE_FLOW;
                aiResponse = await this._generateResponse(clinicConfig, {
                  instruction: `Thank ${patientName.split(" ")[0]} for verifying. They have an admin request. Acknowledge you've noted it and let them know staff will follow up within 24 hours. Ask if there's anything specific to add. Do NOT re-introduce yourself or ask what they need.`,
                  tone,
                  isBusinessHours,
                });
                flags.push("admin_request_logged");
                break;
              case "transfer":
                nextState = INBOUND_STATES.TRANSFER_FLOW;
                if (isBusinessHours) {
                  aiResponse = await this._generateResponse(clinicConfig, {
                    instruction: `Thank ${patientName.split(" ")[0]} for verifying. They want to speak with staff. Let them know you'll transfer them now. Keep it brief - do NOT re-introduce yourself.`,
                    tone,
                    isBusinessHours,
                  });
                  flags.push("transfer_requested");
                  isComplete = true;
                  finalOutcome = "live_transfer";
                } else {
                  aiResponse = await this._generateResponse(clinicConfig, {
                    instruction: `Thank ${patientName.split(" ")[0]} for verifying. They want to speak with staff but it's after hours. Apologize that no one is available and offer to take a message for callback first thing tomorrow. Do NOT re-introduce yourself.`,
                    tone,
                    isBusinessHours,
                  });
                  nextState = INBOUND_STATES.MESSAGE_FLOW;
                }
                break;
              default:
                nextState = INBOUND_STATES.TRIAGE;
                aiResponse = await this._generateTriageQuestion(
                  clinicConfig,
                  tone,
                  patientName,
                );
            }
          } else {
            nextState = INBOUND_STATES.TRIAGE;
            aiResponse = await this._generateTriageQuestion(
              clinicConfig,
              tone,
              patientName,
            );
          }
        } else if (identifyPhaseIntent !== "unclear" && !intent) {
          // Patient is stating intent instead of identity - capture it and gently redirect
          intent = identifyPhaseIntent;
          aiResponse = await this._generateResponse(clinicConfig, {
            instruction: `The patient wants to ${identifyPhaseIntent === "appointment" ? "book an appointment" : identifyPhaseIntent === "clinical" ? "discuss a health concern" : "get help"}. Acknowledge their request warmly and explain you just need their name and date of birth first to pull up their records and assist them properly.`,
            tone,
            isBusinessHours,
          });
        } else if (this._isRefusal(patientMessage)) {
          // Patient refuses to identify - can still take message
          nextState = INBOUND_STATES.MESSAGE_FLOW;
          flags.push("identity_not_verified");
          aiResponse = await this._generateResponse(clinicConfig, {
            instruction:
              "The patient doesn't want to share their details. Acknowledge this politely and offer to take a message instead.",
            tone,
            isBusinessHours,
          });
        } else {
          // Unclear response - ask again more gently
          newConfusionCount++;
          if (newConfusionCount >= 3) {
            nextState = INBOUND_STATES.CONFUSION_EXIT;
            aiResponse = await this._generateConfusionExit(clinicConfig);
            isComplete = true;
            finalOutcome = "confusion_escalation";
          } else {
            aiResponse = await this._generateResponse(clinicConfig, {
              instruction:
                "The patient's response wasn't clear identity information. Gently explain you need their full name and date of birth to verify their identity - for example 'John Smith, 15th January 1980'. Be friendly and helpful.",
              tone,
              isBusinessHours,
            });
          }
        }
        break;

      case INBOUND_STATES.TRIAGE:
        // Classify intent from patient's response
        const detectedIntent = this._classifyIntent(patientMessage);
        intent = detectedIntent;

        switch (detectedIntent) {
          case "appointment":
            nextState = INBOUND_STATES.APPOINTMENT_FLOW;
            aiResponse = await this._handleAppointmentFlow(
              patientMessage,
              clinicConfig,
              patientName,
              isBusinessHours,
            );
            break;
          case "clinical":
            nextState = INBOUND_STATES.CLINICAL_FLOW;
            const clinicalResult = await this._handleClinicalFlow(
              patientMessage,
              clinicConfig,
              isBusinessHours,
              patientName,
            );
            aiResponse = clinicalResult.response;
            if (clinicalResult.urgent) {
              flags.push("clinical_concern_urgent");
              nextState = INBOUND_STATES.TRANSFER_FLOW;
            } else {
              nextState = INBOUND_STATES.MESSAGE_FLOW;
              flags.push("clinical_concern_logged");
            }
            break;
          case "transfer":
            nextState = INBOUND_STATES.TRANSFER_FLOW;
            if (isBusinessHours) {
              aiResponse = await this._generateResponse(clinicConfig, {
                instruction:
                  "The patient wants to speak to a staff member. Let them know you'll transfer them now.",
                tone,
                isBusinessHours,
              });
              flags.push("transfer_requested");
              isComplete = true;
              finalOutcome = "live_transfer";
            } else {
              aiResponse = await this._generateResponse(clinicConfig, {
                instruction:
                  "The patient wants to speak to someone but it's after hours. Apologize, explain no one is available, and offer to take a message for callback.",
                tone,
                isBusinessHours,
              });
              nextState = INBOUND_STATES.MESSAGE_FLOW;
            }
            break;
          case "admin":
            nextState = INBOUND_STATES.MESSAGE_FLOW;
            aiResponse = await this._generateResponse(clinicConfig, {
              instruction: `The patient has an admin request: "${patientMessage}". Acknowledge it and let them know you'll log this for staff to follow up. Ask if there's anything else.`,
              tone,
              isBusinessHours,
            });
            flags.push("admin_request_logged");
            break;
          default:
            // Unclear intent - ask for clarification
            newConfusionCount++;
            if (newConfusionCount >= 3) {
              nextState = INBOUND_STATES.CONFUSION_EXIT;
              aiResponse = await this._generateConfusionExit(clinicConfig);
              isComplete = true;
              finalOutcome = "confusion_escalation";
            } else {
              aiResponse = await this._generateResponse(clinicConfig, {
                instruction:
                  "You didn't quite understand what the patient needs. Ask them to clarify if they want to book an appointment, discuss a health concern, or leave a message for the clinic.",
                tone,
                isBusinessHours,
              });
            }
        }
        break;

      case INBOUND_STATES.APPOINTMENT_FLOW:
        // Check if patient is saying goodbye/done first
        if (this._isDone(patientMessage)) {
          // If appointment was already noted/booked, say proper goodbye and end
          if (
            flags.includes("appointment_noted") ||
            flags.includes("appointment_booked")
          ) {
            nextState = INBOUND_STATES.SUCCESS_EXIT;
            aiResponse = await this._generateResponse(clinicConfig, {
              instruction:
                "The patient is saying goodbye after their appointment was noted/booked. Respond warmly with a proper goodbye - something like 'You're all set! Have a wonderful day, and we'll see you soon. Take care!' Keep it brief and friendly.",
              isBusinessHours,
            });
            isComplete = true;
            finalOutcome = flags.includes("appointment_booked")
              ? "appointment_booked"
              : "appointment_noted";
          } else {
            // No appointment yet, just ending call
            nextState = INBOUND_STATES.SUCCESS_EXIT;
            aiResponse = await this._generateSuccessExit(clinicConfig, flags);
            isComplete = true;
            finalOutcome = "call_ended";
          }
          break;
        }

        // Continue appointment booking flow
        const appointmentResult = await this._continueAppointmentFlow(
          patientMessage,
          conversationState,
          clinicConfig,
        );
        aiResponse = appointmentResult.response;
        if (appointmentResult.booked) {
          // Appointment confirmed - but don't end yet, wait for patient to say goodbye
          flags.push("appointment_booked");
          // Stay in APPOINTMENT_FLOW to handle "anything else?" -> "no thanks" -> goodbye
        } else if (appointmentResult.noted) {
          // Appointment noted (pending approval) - don't end yet
          flags.push("appointment_noted");
        } else if (appointmentResult.needsTransfer) {
          nextState = INBOUND_STATES.TRANSFER_FLOW;
          aiResponse = appointmentResult.response;
        }
        break;

      case INBOUND_STATES.CLINICAL_FLOW:
        // Should have transitioned already, but handle continuation
        nextState = INBOUND_STATES.MESSAGE_FLOW;
        aiResponse = await this._generateResponse(clinicConfig, {
          instruction:
            "Note down the patient's symptoms. Let them know you've recorded this and a clinical staff member will review and call back. Ask if there's anything else.",
          tone,
          isBusinessHours,
        });
        break;

      case INBOUND_STATES.MESSAGE_FLOW:
        // Check if patient is done or has more to add
        if (this._isDone(patientMessage)) {
          nextState = INBOUND_STATES.SUCCESS_EXIT;
          aiResponse = await this._generateSuccessExit(clinicConfig, flags);
          isComplete = true;
          finalOutcome = "message_logged";
        } else {
          aiResponse = await this._generateResponse(clinicConfig, {
            instruction: `The patient said: "${patientMessage}". Acknowledge this, add it to the message, and ask if there's anything else they'd like to add before you pass it along.`,
            tone,
            isBusinessHours,
          });
        }
        break;

      case INBOUND_STATES.TRANSFER_FLOW:
        // Confirm transfer or take message if after hours
        if (isBusinessHours) {
          aiResponse = await this._generateResponse(clinicConfig, {
            instruction:
              "Confirm you're transferring them now. Say goodbye briefly.",
            tone,
            isBusinessHours,
          });
          isComplete = true;
          finalOutcome = "live_transfer";
        } else {
          nextState = INBOUND_STATES.MESSAGE_FLOW;
          aiResponse = await this._generateResponse(clinicConfig, {
            instruction:
              "It's after hours so no one can take the call. Take a message for callback.",
            tone,
            isBusinessHours,
          });
        }
        break;

      default:
        // Fallback
        aiResponse =
          "I apologize, I'm having trouble. Let me connect you with our team.";
        isComplete = true;
        finalOutcome = "system_error_escalation";
    }

    // Add AI response to transcript
    transcript.push({
      role: "assistant",
      content: aiResponse,
      state: nextState,
      timestamp: new Date().toISOString(),
    });

    return {
      ...conversationState,
      currentState: nextState,
      transcript,
      patientIdentified: !!patientName,
      patientName,
      patientDob,
      intent,
      flags,
      confusionCount: newConfusionCount,
      isComplete,
      finalOutcome,
      aiResponse,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STATE MACHINE HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  _detectEmergency(message, clinicConfig) {
    const lowerMessage = message.toLowerCase();
    const emergencyKeywords = [
      ...INTENT_CATEGORIES.EMERGENCY,
      ...(clinicConfig.agent_persona?.safety_enforcement?.emergency_keywords ||
        []),
    ];
    return emergencyKeywords.some((keyword) =>
      lowerMessage.includes(keyword.toLowerCase()),
    );
  }

  _detectTransferRequest(message, clinicConfig) {
    const lowerMessage = message.toLowerCase();

    // Use escalation triggers from clinic config if available
    const configuredTriggers =
      clinicConfig?.call_classification?.escalation_triggers?.keywords || [];

    // Combine with default TRANSFER keywords as fallback
    const allTriggers =
      configuredTriggers.length > 0
        ? configuredTriggers
        : INTENT_CATEGORIES.TRANSFER;

    console.log(`[Transfer] Checking message: "${message}"`);
    console.log(`[Transfer] Configured triggers:`, configuredTriggers);
    console.log(`[Transfer] Using triggers:`, allTriggers);

    // Check for specific variations of "talk/speak to doctor"
    const doctorPatterns = [
      "talk to a doctor",
      "talk to doctor",
      "speak to a doctor",
      "speak to doctor",
      "want to talk to a doctor",
      "want to speak to a doctor",
      "see a doctor",
      "speak with a doctor",
      "talk with a doctor",
    ];

    // Check doctor patterns first
    const doctorMatch = doctorPatterns.some((pattern) =>
      lowerMessage.includes(pattern),
    );
    if (doctorMatch) {
      console.log(`[Transfer] Doctor pattern matched in: "${message}"`);
      return true;
    }

    // Check configured triggers
    const triggered = allTriggers.some((keyword) => {
      const matches = lowerMessage.includes(keyword.toLowerCase());
      if (matches) {
        console.log(`[Transfer] Keyword "${keyword}" matched in: "${message}"`);
      }
      return matches;
    });

    if (triggered) {
      console.log(
        `[Transfer] Escalation triggered by configured keywords in: "${message.substring(0, 50)}..."`,
      );
    } else {
      console.log(`[Transfer] No escalation triggers found in: "${message}"`);
    }

    return triggered;
  }

  async _generateTransferResponse(clinicConfig, isBusinessHours) {
    const tone = clinicConfig.agent_persona?.tone_preference || "professional";

    if (isBusinessHours) {
      const response = await this.aiService.generateResponse(
        "Generate transfer response",
        {
          clinicConfig,
          instruction: `The patient wants to speak directly to a staff member. Let them know you'll transfer them right away. Be brief and accommodating. Use a ${tone} tone.`,
        },
      );
      return (
        response.text ||
        "Absolutely, I'll transfer you to one of our staff members right now. Please hold for just a moment."
      );
    } else {
      const response = await this.aiService.generateResponse(
        "Generate after-hours transfer response",
        {
          clinicConfig,
          instruction: `The patient wants to speak to a staff member but it's after hours. Apologize that no one is available right now. Let them know you'll leave an urgent message for someone to call them back first thing when the clinic opens. Ask if there's anything urgent they need help with in the meantime. Use a ${tone} tone.`,
        },
      );
      return (
        response.text ||
        "I understand you'd like to speak with someone directly. Unfortunately, our clinic is currently closed for the day. I'll leave an urgent message for our team to call you back first thing when we reopen. Is there anything urgent I can help you with in the meantime?"
      );
    }
  }

  async _generateEmergencyResponse(clinicConfig) {
    const response = await this.aiService.generateResponse(
      "Generate emergency response",
      {
        clinicConfig,
        instruction:
          "This is an EMERGENCY. Tell the patient to hang up immediately and call 000 (or go to nearest emergency department). Be firm but caring. Do NOT offer to book appointments or take messages. Their safety is the only priority.",
      },
    );
    return (
      response.text ||
      "This sounds like an emergency. Please hang up and call 000 immediately, or go to your nearest emergency department. Your safety is the priority right now."
    );
  }

  async _generateIdentifyRequest(clinicConfig, tone) {
    const response = await this.aiService.generateResponse(
      "Generate identity verification request",
      {
        clinicConfig,
        instruction: `Ask the patient for their full name and date of birth to verify their identity. Use a ${tone} tone. Keep it brief and natural.`,
      },
    );
    return (
      response.text ||
      "To get started, could I please have your full name and date of birth?"
    );
  }

  async _generateTriageQuestion(clinicConfig, tone, patientName) {
    const response = await this.aiService.generateResponse(
      "Generate triage question",
      {
        clinicConfig,
        instruction: `Thank ${patientName || "the patient"} for verifying their identity. Now ask how you can help them today. Use a ${tone} tone.`,
      },
    );
    return (
      response.text ||
      `Thank you${patientName ? `, ${patientName.split(" ")[0]}` : ""}. How can I help you today?`
    );
  }

  async _generateConfusionExit(clinicConfig) {
    const response = await this.aiService.generateResponse(
      "Generate confusion exit",
      {
        clinicConfig,
        instruction:
          "You've had trouble understanding the patient 3 times. Apologize sincerely, explain you'll have a receptionist call them back at this number. Say goodbye politely.",
      },
    );
    return (
      response.text ||
      "I'm so sorry, I'm having trouble understanding. I'll have one of our receptionists call you back at this number shortly. Thank you for your patience. Goodbye."
    );
  }

  async _generateSuccessExit(clinicConfig, flags) {
    const hasFlags = flags.length > 0;
    const response = await this.aiService.generateResponse(
      "Generate success exit",
      {
        clinicConfig,
        instruction: hasFlags
          ? "The call is complete. Summarize that you've noted their concerns/requests and someone will follow up. Ask if there's anything else, then say goodbye warmly."
          : "The call is complete and resolved. Ask if there's anything else you can help with. If not, say goodbye warmly.",
      },
    );
    return (
      response.text ||
      "I've got all of that noted down. Is there anything else I can help you with? ... Take care, goodbye!"
    );
  }

  async _generateResponse(clinicConfig, options) {
    const tone =
      options.tone ||
      clinicConfig.agent_persona?.tone_preference ||
      "professional";
    const response = await this.aiService.generateResponse(
      "Generate response",
      {
        clinicConfig,
        instruction: options.instruction,
        isBusinessHours: options.isBusinessHours,
        tone, // Explicitly pass tone for AI to use
      },
    );
    return response.text || "How can I help you further?";
  }

  async _extractIdentity(message) {
    // Use LLM to extract name and DOB from natural language input
    const result = { name: null, dob: null };

    try {
      const extractionPrompt = `Extract the patient's full name and date of birth from this message. The patient is providing their identity information.

Patient's message: "${message}"

Respond ONLY in this exact JSON format, nothing else:
{"name": "Full Name" or null, "dob": "DD/MM/YYYY" or null}

Rules:
- Extract the full name (first and last name) if provided
- Convert any date format to DD/MM/YYYY (day/month/year)
- If the year is 2-digit, assume 1900s for values > 30, 2000s for values <= 30
- If name or DOB is not found or unclear, use null
- Do NOT make up information - only extract what's explicitly stated`;

      const response = await this.aiService._chatCompletion(
        [{ role: "user", content: extractionPrompt }],
        { temperature: 0.1, max_tokens: 100 },
      );

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        result.name = parsed.name || null;
        result.dob = parsed.dob || null;
      }

      console.log(
        `[Identity] Extracted from "${message.substring(0, 50)}...":`,
        result,
      );
    } catch (error) {
      console.error("[Identity] LLM extraction error:", error.message);
    }

    return result;
  }

  _isRefusal(message) {
    const refusalPhrases = [
      "don't want to",
      "won't give",
      "prefer not",
      "rather not",
      "skip that",
      "not comfortable",
      "just want to",
      "can we skip",
    ];
    const lowerMessage = message.toLowerCase();
    return refusalPhrases.some((phrase) => lowerMessage.includes(phrase));
  }

  _classifyIntent(message) {
    const lowerMessage = message.toLowerCase();

    // Check each category
    for (const [category, keywords] of Object.entries(INTENT_CATEGORIES)) {
      if (category === "EMERGENCY") continue; // Already handled separately
      if (
        keywords.some((keyword) => lowerMessage.includes(keyword.toLowerCase()))
      ) {
        return category.toLowerCase();
      }
    }

    return "unclear";
  }

  _isDone(message) {
    const donePhrases = [
      "no",
      "that's all",
      "that's it",
      "nothing else",
      "i'm good",
      "all good",
      "nope",
      "no thanks",
      "that will be all",
      "goodbye",
      "bye",
      "thank you",
      "thanks",
    ];
    const lowerMessage = message.toLowerCase().trim();
    return donePhrases.some(
      (phrase) => lowerMessage === phrase || lowerMessage.startsWith(phrase),
    );
  }

  async _handleAppointmentFlow(
    message,
    clinicConfig,
    patientName,
    isBusinessHours,
  ) {
    // Check if they mentioned a specific doctor
    const doctorMention = this._extractDoctorName(message, clinicConfig);
    const firstName = patientName ? patientName.split(" ")[0] : "";

    // Build list of doctors who ARE accepting new patients (for alternatives)
    const availableDoctors = (clinicConfig.staff_directory || [])
      .filter((s) => s.booking_rules?.accepts_new_patients !== false)
      .map((s) => {
        const rules = s.booking_rules || {};
        let info = `Dr. ${s.name} (${s.role || "GP"})`;
        if (rules.specializations?.length)
          info += ` - specializes in ${rules.specializations.join(", ")}`;
        return info;
      });

    // Hardcoded callback window for demo purposes
    const callbackTime = "tomorrow morning between 8:30 AM and 9:30 AM";

    let instruction;
    if (doctorMention) {
      // Check if doctor takes new patients, has restrictions, etc.
      const doctor = clinicConfig.staff_directory?.find((c) =>
        c.name.toLowerCase().includes(doctorMention.toLowerCase()),
      );
      const bookingRules = doctor?.booking_rules || {};

      if (doctor && !bookingRules.accepts_new_patients) {
        // Doctor not accepting new patients - suggest alternatives
        const alternatives =
          availableDoctors.length > 0
            ? availableDoctors.join(", ")
            : "any available GP";
        instruction = `Thank ${firstName} for verifying their identity. They want to see Dr. ${doctor.name}, but unfortunately Dr. ${doctor.name} isn't currently accepting new patients. Apologize sincerely and suggest these alternatives who ARE accepting new patients: ${alternatives}. Ask if any of them would work, or if they'd like whoever has the earliest availability. Do NOT re-introduce yourself.`;
      } else if (!isBusinessHours) {
        // AFTER HOURS: Note the preference and let them know front desk will call back
        instruction = `Thank ${firstName} for verifying their identity. They want to book with Dr. ${doctor?.name || doctorMention}. Since the clinic is currently closed, let them know you've noted their request for an appointment with Dr. ${doctor?.name || doctorMention} and have passed it to the front desk. The reception team will call them back ${callbackTime} to confirm a suitable time. Ask if there's anything else you can help with. Do NOT offer specific time slots - the front desk will handle that. Do NOT re-introduce yourself.`;
      } else if (bookingRules.requires_manual_approval) {
        instruction = `Thank ${firstName} for verifying their identity. They want to see Dr. ${doctor.name}. This doctor requires approval for new bookings. Let them know you'll note the request and someone will call back to confirm. Do NOT re-introduce yourself.`;
      } else {
        // Doctor is available - offer 2 time slot options
        instruction = `Thank ${firstName} for verifying their identity. They want to book with Dr. ${doctor?.name || doctorMention}. Offer exactly 2 available time slots - for example "tomorrow at 10:00 AM" and "Thursday at 2:30 PM". Ask which works better for them. Do NOT auto-confirm the booking yet - wait for them to choose a time. Do NOT re-introduce yourself.`;
      }
    } else {
      // No specific doctor mentioned - ask about preference simply
      instruction = `Thank ${firstName} for verifying their identity. They want to book an appointment. Simply ask: "Do you have a particular doctor you'd like to see, or would any available GP be fine?" Keep it brief and natural - do NOT list out all the doctors, do NOT re-introduce yourself.`;
    }

    const response = await this._generateResponse(clinicConfig, {
      instruction,
      isBusinessHours,
    });
    return response;
  }

  async _continueAppointmentFlow(message, conversationState, clinicConfig) {
    const lowerMessage = message.toLowerCase();
    const isBusinessHours = conversationState.isBusinessHours;
    const transcript = conversationState.transcript || [];

    // Build conversation history string for context
    const recentHistory = transcript
      .slice(-6)
      .map(
        (t) => `${t.role === "assistant" ? "Heidi" : "Patient"}: ${t.content}`,
      )
      .join("\n");

    // Build list of doctors accepting new patients
    const staffDirectory = clinicConfig.staff_directory || [];
    const availableDoctors = staffDirectory
      .filter((c) => c.booking_rules?.accepts_new_patients !== false)
      .map((c) => {
        const rules = c.booking_rules || {};
        let info = `Dr. ${c.name} (${c.role || "GP"})`;
        if (rules.specializations?.length)
          info += ` - specializes in ${rules.specializations.join(", ")}`;
        return info;
      });

    const availableDoctorsList =
      availableDoctors.length > 0
        ? availableDoctors.join(", ")
        : "any available GP";

    // Hardcoded callback window for demo purposes
    const callbackTime = "tomorrow morning between 8:30 AM and 9:30 AM";

    // Check if patient mentioned a specific doctor
    const doctorMention = this._extractDoctorName(message, clinicConfig);
    if (doctorMention) {
      const doctor = staffDirectory.find((c) =>
        c.name.toLowerCase().includes(doctorMention.toLowerCase()),
      );
      const bookingRules = doctor?.booking_rules || {};

      if (doctor && !bookingRules.accepts_new_patients) {
        // Doctor not accepting new patients
        const response = await this._generateResponse(clinicConfig, {
          instruction: `The patient asked for Dr. ${doctor.name}, but Dr. ${doctor.name} is NOT accepting new patients. Apologize sincerely and suggest these doctors who ARE accepting new patients: ${availableDoctorsList}. Ask if any of them would work instead.`,
          isBusinessHours,
          conversationHistory: recentHistory,
        });
        return { response, booked: false };
      } else if (!isBusinessHours && doctor) {
        // AFTER HOURS: Note the preference and let front desk call back
        const response = await this._generateResponse(clinicConfig, {
          instruction: `The patient wants to book with Dr. ${doctor.name}. Since the clinic is currently closed, let them know you've noted their request for an appointment with Dr. ${doctor.name} and have passed it to the front desk. The reception team will call them back ${callbackTime} to confirm a suitable time. Ask if there's anything else you can help with. Do NOT offer specific time slots.`,
          isBusinessHours,
          conversationHistory: recentHistory,
        });
        return { response, booked: false, noted: true };
      } else if (doctor) {
        // Doctor is available - offer 2 time slots
        const response = await this._generateResponse(clinicConfig, {
          instruction: `The patient wants to book with Dr. ${doctor.name}. First say that Dr. ${doctor.name} is available. Then, offer exactly 2 specific time slots - for example "tomorrow (Wednesday) at 10:00 AM" and "Friday at 2:30 PM". Ask which one works better for them. Do NOT confirm the booking yet - wait for them to choose.`,
          isBusinessHours,
          conversationHistory: recentHistory,
        });
        return { response, booked: false };
      }
    }

    // Check if they said "any doctor" or "anyone available"
    const anyDoctorPhrases = [
      "any doctor",
      "anyone",
      "any gp",
      "whoever",
      "don't mind",
      "no preference",
      "any available",
      "doesn't matter",
    ];
    const wantsAnyDoctor = anyDoctorPhrases.some((phrase) =>
      lowerMessage.includes(phrase),
    );

    if (wantsAnyDoctor) {
      // Pick the first available doctor
      const firstAvailable = staffDirectory.find(
        (c) => c.booking_rules?.accepts_new_patients !== false,
      );
      const doctorName = firstAvailable
        ? `Dr. ${firstAvailable.name}`
        : "our next available GP";

      if (!isBusinessHours) {
        // AFTER HOURS: Note the preference and let front desk call back
        const response = await this._generateResponse(clinicConfig, {
          instruction: `The patient is happy with any available doctor. Since the clinic is currently closed, let them know you've noted their request for an appointment with the next available GP and have passed it to the front desk. The reception team will call them back ${callbackTime} to confirm a suitable time. Ask if there's anything else you can help with. Do NOT offer specific time slots.`,
          isBusinessHours,
          conversationHistory: recentHistory,
        });
        return { response, booked: false, noted: true };
      }

      // Business hours - offer time slots
      const response = await this._generateResponse(clinicConfig, {
        instruction: `The patient is happy with any available doctor. ${doctorName} has the earliest availability. Offer exactly 2 specific time slots with ${doctorName} - for example "tomorrow at 10:00 AM" and "Thursday at 3:00 PM". Ask which works better for them. Do NOT confirm the booking yet.`,
        isBusinessHours,
        conversationHistory: recentHistory,
      });
      return { response, booked: false };
    }

    // Get last assistant message for context
    const lastAssistantMsg =
      transcript.filter((t) => t.role === "assistant").slice(-1)[0]?.content ||
      "";

    // Use LLM to determine patient intent
    const intentAnalysis = await this._analyzeAppointmentIntent(
      message,
      recentHistory,
      lastAssistantMsg,
    );

    // If patient is accepting an alternative doctor suggestion, offer time slots
    if (intentAnalysis.intent === "accepting_doctor") {
      const suggestedDoctor = intentAnalysis.doctorName || "the doctor";
      const response = await this._generateResponse(clinicConfig, {
        instruction: `The patient has accepted your suggestion to see Dr. ${suggestedDoctor}. Now offer them 2 specific available time slots for Dr. ${suggestedDoctor}. 

Example format: "Great! I have two slots available with Dr. ${suggestedDoctor}: tomorrow at 10:00 AM, or Thursday at 2:30 PM. Which works better for you?"

Be specific with dates and times. Keep it brief and friendly.`,
        isBusinessHours,
        conversationHistory: recentHistory,
      });
      return { response, booked: false };
    }

    // If patient is confirming a time slot
    if (intentAnalysis.intent === "confirming_time") {
      // Find the doctor being booked from conversation context
      const doctor = this._extractDoctorFromHistory(
        recentHistory,
        staffDirectory,
      );
      const bookingRules = doctor?.booking_rules || {};

      if (bookingRules.requires_manual_approval) {
        const doctorName = doctor?.name;
        // Doctor requires manual approval - note the appointment, don't confirm
        const response = await this._generateResponse(clinicConfig, {
          instruction: `The patient is selecting a time slot. They said: "${message}"

RECENT CONVERSATION:
${recentHistory}

IMPORTANT: Dr. ${doctorName} requires manual approval for new appointments. 

Respond by:
1. Acknowledging their preferred time slot
2. Explaining that Dr. ${doctorName} reviews and approves all new appointments personally
3. Let them know you've noted their request and the clinic will reach out to confirm once the doctor has approved it
4. Ask if there's anything else you can help with

Do NOT say the appointment is "confirmed" - say it's "noted" or "requested" pending approval.`,
          isBusinessHours,
          conversationHistory: recentHistory,
        });
        return { response, booked: false, noted: true };
      } else {
        // Regular booking - confirm the appointment
        const response = await this._generateResponse(clinicConfig, {
          instruction: `The patient is confirming an appointment time. They said: "${message}"

RECENT CONVERSATION:
${recentHistory}

Based on the conversation above, confirm the specific time slot they selected. Include the doctor's name, date, and time in the confirmation. Then ask if there's anything else you can help with.`,
          isBusinessHours,
          conversationHistory: recentHistory,
        });
        return { response, booked: true };
      }
    }

    // Check if they want to transfer
    if (
      lowerMessage.includes("speak to someone") ||
      lowerMessage.includes("talk to")
    ) {
      const response = await this._generateResponse(clinicConfig, {
        instruction:
          "The patient wants to speak to a person instead of booking through you. Acknowledge and prepare to transfer.",
        isBusinessHours,
      });
      return { response, needsTransfer: true };
    }

    // Otherwise continue the flow
    const response = await this._generateResponse(clinicConfig, {
      instruction: `Continue helping the patient book an appointment. They said: "${message}"

DOCTORS ACCEPTING NEW PATIENTS: ${availableDoctorsList}

RECENT CONVERSATION:
${recentHistory}

If they're asking about a specific doctor, check if that doctor is in the list above. If they mention a doctor NOT in the list, that doctor is not accepting new patients - apologize and suggest alternatives. If they're choosing between options, help them decide. Only mention doctors from the list above.`,
      isBusinessHours,
      conversationHistory: recentHistory,
    });
    return { response, booked: false };
  }

  async _handleClinicalFlow(
    message,
    clinicConfig,
    isBusinessHours,
    patientName = null,
  ) {
    // Check urgency of symptoms
    const urgentKeywords = [
      "severe",
      "very bad",
      "worst",
      "unbearable",
      "getting worse",
      "spreading",
      "high fever",
      "can't sleep",
      "worried",
    ];
    const lowerMessage = message.toLowerCase();
    const isUrgent = urgentKeywords.some((keyword) =>
      lowerMessage.includes(keyword),
    );

    const firstName = patientName ? patientName.split(" ")[0] : "them";
    const thankPrefix = patientName ? `Thank ${firstName} for verifying. ` : "";
    const doNotReintro =
      " Do NOT re-introduce yourself or ask what they need - proceed directly with helping.";

    let instruction;
    if (isUrgent && isBusinessHours) {
      instruction = `${thankPrefix}The patient described concerning symptoms: "${message}". This sounds like it needs clinical attention. Let them know you'll have a nurse call them back shortly, or offer to connect them with clinical staff now.${doNotReintro}`;
    } else if (isUrgent && !isBusinessHours) {
      instruction = `${thankPrefix}The patient described concerning symptoms after hours: "${message}". Express concern, recommend they consider urgent care if symptoms worsen, and take a message for urgent callback first thing tomorrow.${doNotReintro}`;
    } else {
      instruction = `${thankPrefix}The patient mentioned a health concern: "${message}". It doesn't sound urgent. Take note of it, ask how long they've had it, and let them know you'll pass this to the clinical team for follow-up.${doNotReintro}`;
    }

    const response = await this._generateResponse(clinicConfig, {
      instruction,
      isBusinessHours,
    });
    return { response, urgent: isUrgent };
  }

  _extractDoctorName(message, clinicConfig) {
    const clinicians = clinicConfig.staff_directory || [];
    const lowerMessage = message.toLowerCase();

    for (const clinician of clinicians) {
      const nameParts = clinician.name.toLowerCase().split(" ");
      for (const part of nameParts) {
        if (part.length > 2 && lowerMessage.includes(part)) {
          return clinician.name;
        }
      }
    }

    // Check for generic "dr." or "doctor" mentions
    const drMatch = message.match(/(?:dr\.?|doctor)\s+([a-z]+)/i);
    if (drMatch) {
      return drMatch[1];
    }

    return null;
  }

  /**
   * Use LLM to analyze patient intent during appointment flow
   * Returns: { intent: 'accepting_doctor' | 'confirming_time' | 'other', doctorName?: string }
   */
  async _analyzeAppointmentIntent(
    message,
    conversationHistory,
    lastAssistantMsg,
  ) {
    try {
      const prompt = `Analyze this patient message in the context of booking an appointment.

LAST ASSISTANT MESSAGE:
"${lastAssistantMsg}"

PATIENT'S RESPONSE:
"${message}"

Based on the context, what is the patient doing? Choose ONE:
1. "accepting_doctor" - Patient is agreeing to see a suggested/alternative doctor (e.g., "yes", "sure", "that works", "sounds good" in response to a doctor suggestion)
2. "confirming_time" - Patient is selecting or confirming a specific appointment time slot (e.g., "the 10am one", "tomorrow works", "I'll take the first one", "Friday at 2pm")
3. "other" - Patient is doing something else (asking questions, requesting different options, etc.)

If the intent is "accepting_doctor", also extract the doctor's name from the assistant's message if mentioned.

Respond ONLY in this exact JSON format:
{"intent": "accepting_doctor" | "confirming_time" | "other", "doctorName": "Name" or null}`;

      const response = await this.aiService._chatCompletion(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, max_tokens: 100 },
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }
    } catch (error) {
      console.error("[AppointmentIntent] Analysis error:", error.message);
    }

    return { intent: "other", doctorName: null };
  }

  /**
   * Extract doctor from conversation history
   * Returns the staff object from staffDirectory if found, or null
   * IMPORTANT: Returns the MOST RECENTLY mentioned doctor, not the first found
   */
  _extractDoctorFromHistory(conversationHistory, staffDirectory) {
    // Find all doctor mentions with their positions in the conversation
    const mentions = [];
    const lowerHistory = conversationHistory.toLowerCase();

    // Check each staff member and find their last mention position
    for (const staff of staffDirectory) {
      const nameParts = staff.name.toLowerCase().split(" ");
      for (const part of nameParts) {
        if (part.length > 2) {
          // Find all variations of the doctor name
          const patterns = [`dr. ${part}`, `dr ${part}`, `doctor ${part}`];
          for (const pattern of patterns) {
            const lastIndex = lowerHistory.lastIndexOf(pattern);
            if (lastIndex !== -1) {
              mentions.push({ staff, position: lastIndex, pattern });
            }
          }
        }
      }
    }

    // Also check for "Dr. Name" pattern (capitalized) and match to staff
    const drMatches = conversationHistory.matchAll(/Dr\.?\s+([A-Z][a-z]+)/g);
    for (const match of drMatches) {
      const extractedName = match[1].toLowerCase();
      const matchedStaff = staffDirectory.find((s) =>
        s.name.toLowerCase().includes(extractedName),
      );
      if (matchedStaff) {
        mentions.push({
          staff: matchedStaff,
          position: match.index,
          pattern: match[0],
        });
      }
    }

    // Return the most recently mentioned doctor (highest position)
    if (mentions.length > 0) {
      mentions.sort((a, b) => b.position - a.position);
      const mostRecent = mentions[0];
      return mostRecent.staff;
    }

    console.log(`[ExtractDoctor] No doctor found in history`);
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // OUTBOUND CALL AI ANALYSIS METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Use AI to analyze patient's response for side effects
   * @param {string} message - Patient's message about side effects
   * @returns {Promise<{hasSideEffects: boolean, severeSideEffects: boolean, reportedSymptoms: string[]}>}
   */
  async _analyzeSideEffects(message) {
    try {
      const prompt = `Analyze this patient's response about medication side effects.

Patient said: "${message}"

Determine:
1. Has the patient reported ANY side effects? (even mild ones like slight dizziness, occasional cough, mild tiredness)
2. Are any side effects SEVERE or concerning? (things like: fainting, falling, chest pain, difficulty breathing, severe dizziness combined with nausea, symptoms significantly impacting daily life, or the patient expressing serious concern)
3. List the specific symptoms mentioned

Respond ONLY in this exact JSON format:
{"hasSideEffects": true/false, "severeSideEffects": true/false, "reportedSymptoms": ["symptom1", "symptom2"]}

Rules:
- "no", "none", "I'm fine", "all good" = no side effects
- Any mention of physical symptoms = has side effects
- Severe = symptoms that could indicate medical emergency or significantly impact daily functioning
- If uncertain, err on the side of caution (flag as side effects)`;

      const response = await this.aiService._chatCompletion(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, max_tokens: 150 },
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[SideEffects] AI analysis:`, parsed);
        return {
          hasSideEffects: parsed.hasSideEffects || false,
          severeSideEffects: parsed.severeSideEffects || false,
          reportedSymptoms: parsed.reportedSymptoms || [],
        };
      }
    } catch (error) {
      console.error("[SideEffects] AI analysis error:", error.message);
    }
  }

  /**
   * Use AI to analyze patient's medication adherence
   * @param {string} message - Patient's message about taking medication
   * @returns {Promise<{goodAdherence: boolean, poorAdherence: boolean, adherenceDetails: string}>}
   */
  async _analyzeAdherence(message) {
    try {
      const prompt = `Analyze this patient's response about their medication adherence (whether they've been taking their medication as prescribed - once daily).

Patient said: "${message}"

Determine:
1. GOOD adherence: Patient confirms taking medication regularly/consistently/as prescribed
2. POOR adherence: Patient indicates missing doses, forgetting, skipping, stopping, running out, or inconsistent use
3. Brief summary of their adherence pattern

Respond ONLY in this exact JSON format:
{"goodAdherence": true/false, "poorAdherence": true/false, "adherenceDetails": "brief summary"}

Rules:
- "yes", "every day", "as prescribed", "regularly" = good adherence
- "missed", "forgot", "skip", "sometimes", "ran out", "stopped" = poor adherence
- If response is ambiguous or neutral, set both to false
- goodAdherence and poorAdherence should not both be true`;

      const response = await this.aiService._chatCompletion(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, max_tokens: 150 },
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[Adherence] AI analysis:`, parsed);
        return {
          goodAdherence: parsed.goodAdherence || false,
          poorAdherence: parsed.poorAdherence || false,
          adherenceDetails: parsed.adherenceDetails || "",
        };
      }
    } catch (error) {
      console.error("[Adherence] AI analysis error:", error.message);
    }

    // Fallback to neutral on error
    return { goodAdherence: false, poorAdherence: false, adherenceDetails: "" };
  }

  /**
   * Use AI to analyze the reason for medication non-adherence
   * @param {string} message - Patient's explanation for non-adherence
   * @returns {Promise<{reason: string, details: string}>}
   */
  async _analyzeNonAdherenceReason(message) {
    try {
      const prompt = `Analyze why this patient hasn't been taking their medication consistently.

Patient said: "${message}"

Categorize the PRIMARY reason into one of these categories:
- "forgetting" - memory issues, busy schedule, no routine
- "side_effects" - medication made them feel unwell
- "ran_out" - ran out of pills, prescription issues, couldn't get refill
- "cost" - financial barriers, too expensive
- "intentional" - deliberately stopped, doesn't believe it's helping, concerned about dependency
- "other" - doesn't fit other categories

Respond ONLY in this exact JSON format:
{"reason": "category", "details": "brief specific explanation from their response"}

Examples:
- "I keep forgetting to take it in the morning" -> {"reason": "forgetting", "details": "forgets morning dose"}
- "It makes me feel dizzy so I stopped" -> {"reason": "side_effects", "details": "stopped due to dizziness"}
- "My prescription ran out and I couldn't get to the pharmacy" -> {"reason": "ran_out", "details": "prescription ran out, pharmacy access issue"}`;

      const response = await this.aiService._chatCompletion(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, max_tokens: 150 },
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[NonAdherenceReason] AI analysis:`, parsed);
        return {
          reason: parsed.reason || "other",
          details: parsed.details || "",
        };
      }
    } catch (error) {
      console.error("[NonAdherenceReason] AI analysis error:", error.message);
    }

    // Fallback on error
    return { reason: "other", details: "" };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check if within business hours using explicit day and time strings
   * @param {object} config - Clinic configuration with operating_hours
   * @param {string} day - Lowercase day name (e.g., "monday", "tuesday")
   * @param {string} time - Time in HH:MM format (e.g., "10:00", "14:30")
   * @returns {boolean} True if within business hours
   */
  _isBusinessHours(config, day, time) {
    const schedule = config.operating_hours?.schedule?.[day.toLowerCase()];
    if (!schedule?.is_open) return false;

    // Parse the time string (HH:MM)
    const [hour, min] = time.split(":").map(Number);
    const currentMinutes = hour * 60 + min;

    // Parse schedule times
    const [startHour, startMin] = schedule.start.split(":").map(Number);
    const [endHour, endMin] = schedule.end.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  _calculateFollowupDate(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString("en-AU", { month: "long", day: "numeric" });
  }
}

module.exports = CallSimulator;
