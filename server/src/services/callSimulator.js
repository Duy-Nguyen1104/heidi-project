/**
 * Call Simulator Service
 *
 * Simulates call handling behavior based on clinic configuration.
 * Uses models in LM Studio for generating responses and analyzing sentiment.
 */

const AIService = require("./AIService");

class CallSimulator {
  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Simulate an inbound call based on clinic configuration
   */
  async simulateInboundCall(clinicConfig, callContext) {
    const { currentTime, callerIntent, callerMessage } = callContext;

    const isBusinessHours = this._isBusinessHours(clinicConfig, currentTime);
    const classification = this._classifyCall(
      clinicConfig,
      callerMessage,
      callerIntent,
    );
    const shouldEscalate = this._shouldEscalate(
      clinicConfig,
      callerMessage,
      callerIntent,
    );

    // Determine which workflow to use
    const workflow = isBusinessHours
      ? clinicConfig.workflow_rules?.business_hours_logic
      : clinicConfig.workflow_rules?.after_hours_logic;

    const steps = [];
    let finalAction = "";
    let flags = [];

    // Step 1: Emergency check
    if (this._isEmergency(clinicConfig, callerMessage)) {
      // Use AI to generate emergency response
      const aiResponse = await this.aiService.generateResponse(callerMessage, {
        clinicConfig,
        isBusinessHours,
        isEmergency: true,
      });

      steps.push({
        step: 1,
        action: "emergency_detected",
        aiResponse:
          aiResponse.text ||
          "This sounds like an emergency. Please hang up and call 000 immediately for emergency services.",
        intent: aiResponse.intent,
        entities: aiResponse.entities,
      });
      finalAction = "emergency_redirect";
      return {
        steps,
        finalAction,
        classification: "emergency",
        isBusinessHours,
        flags,
      };
    }

    // Step 2: Generate AI greeting and response
    const aiResponse = await this.aiService.generateResponse(callerMessage, {
      clinicConfig,
      isBusinessHours,
    });

    steps.push({
      step: 1,
      action: "ai_response",
      aiResponse: aiResponse.text,
      intent: aiResponse.intent,
      entities: aiResponse.entities,
      confidence: aiResponse.confidence,
    });

    // Step 3: Handle based on AI-detected intent and classification
    const detectedIntent = aiResponse.intent || callerIntent;

    if (
      classification === "escalation" ||
      shouldEscalate ||
      detectedIntent === "complaint" ||
      detectedIntent === "speak_to_human"
    ) {
      if (isBusinessHours && workflow?.live_transfer_enabled) {
        steps.push({
          step: 2,
          action: "escalate_to_staff",
          aiResponse:
            clinicConfig.agent_persona?.handover_behavior?.phrase ||
            "Let me connect you with our team to help further.",
        });
        finalAction = "live_transfer";
      } else {
        steps.push({
          step: 2,
          action: "take_message",
          aiResponse:
            "I'll make sure our team gets your message and contacts you as soon as possible. Can I take your details?",
        });
        finalAction = "message_taken";
        flags.push("urgent_callback_required");
      }
    } else if (
      classification === "voicemail" ||
      detectedIntent === "leave_message"
    ) {
      steps.push({
        step: 2,
        action: "voicemail_prompt",
        aiResponse:
          "I'll take a message for you. Please leave your name, number, and a brief message, and someone will get back to you.",
      });
      finalAction = "voicemail_recorded";
    } else {
      // AI has already attempted resolution in step 1
      // Determine if we need additional steps based on intent
      if (this._isWithinScope(clinicConfig, detectedIntent)) {
        finalAction = this._mapIntentToAction(detectedIntent);
      } else {
        // Fallback for out of scope
        if (isBusinessHours) {
          steps.push({
            step: 2,
            action: "fallback_escalate",
            aiResponse:
              "I want to make sure you get the right help. Let me connect you with our team.",
          });
          finalAction = "escalated_after_attempt";
        } else {
          steps.push({
            step: 2,
            action: "fallback_message",
            aiResponse:
              "I'll make sure our team follows up with you first thing tomorrow.",
          });
          finalAction = "message_for_followup";
        }
      }
    }

    // Analyze sentiment of the caller's message
    const sentiment = await this.aiService.analyzeSentiment(callerMessage);
    if (sentiment.sentiment === "negative") {
      flags.push("negative_sentiment_detected");
    }

    return {
      steps,
      finalAction,
      classification,
      isBusinessHours,
      flags,
      sentiment,
      workflowUsed: isBusinessHours
        ? "business_hours_logic"
        : "after_hours_logic",
    };
  }

  /**
   * Simulate an outbound follow-up call (e.g., Zestril medication follow-up)
   * Uses AI to generate dynamic, context-aware responses
   */
  async simulateFollowupCall(clinicConfig, templateId, patientResponses) {
    const clinicName = clinicConfig.clinic_name || "Northside Medical";
    const tone = clinicConfig.agent_persona?.tone_preference || "empathetic";
    const steps = [];
    const flags = [];
    let escalateToDoctor = false;
    let conversationContext = [];

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

    // Step 0: Opening - AI generates introduction
    const openingResponse = await this.aiService.generateFollowupResponse({
      ...baseContext,
      step: "opening",
      instruction:
        "Introduce yourself as Heidi, the digital care partner. State you're calling from the clinic about their blood pressure medication follow-up. Mention you'll share their responses with their clinician. Ask if it's a good time to chat for a few minutes. Be warm but professional.",
      conversationHistory: [],
    });

    const openingPrompt =
      openingResponse.text ||
      `Hi there, this is Heidi, your digital care partner calling from ${clinicName}. I'm reaching out to check in on how you're doing with your new blood pressure medication. Is now a good time for a quick chat?`;

    conversationContext.push({ role: "assistant", content: openingPrompt });
    conversationContext.push({
      role: "user",
      content: patientResponses[0]?.text || "Yes",
    });

    steps.push({
      stepNumber: 0,
      action: "opening",
      aiPrompt: openingPrompt,
      patientResponse: patientResponses[0]?.text || "Yes, I can talk now",
      outcome: "patient_available",
    });

    // Step 1: Verify Identity - AI generates verification request
    const identityResponse = await this.aiService.generateFollowupResponse({
      ...baseContext,
      step: "verify_identity",
      instruction:
        "Transition naturally from the opening. Ask the patient to confirm their name and date of birth so you know you're speaking to the right person. Keep it conversational.",
      conversationHistory: conversationContext,
    });

    const identityPrompt =
      identityResponse.text ||
      "Wonderful! Just to make sure I've got the right person, could you confirm your name and date of birth for me?";

    conversationContext.push({ role: "assistant", content: identityPrompt });
    conversationContext.push({
      role: "user",
      content: patientResponses[1]?.text || "No response",
    });

    steps.push({
      stepNumber: 1,
      action: "verify_identity",
      aiPrompt: identityPrompt,
      patientResponse: patientResponses[1]?.text || "No response",
      outcome: patientResponses[1]?.text
        ? "identity_verified"
        : "verification_failed",
    });

    // Step 2: Check Side Effects - AI asks about side effects
    const sideEffectResponse = await this.aiService.generateFollowupResponse({
      ...baseContext,
      step: "check_side_effects",
      instruction:
        "Thank them for confirming their identity. Now ask about any side effects since starting Zestril. Mention common ones like lightheadedness, dizziness, or dry cough. Show genuine concern.",
      conversationHistory: conversationContext,
    });

    const sideEffectPrompt =
      sideEffectResponse.text ||
      "Thanks for confirming. Now, have you noticed any side effects since you started taking the Zestril? Some people experience things like feeling lightheaded, dizzy, or a dry cough.";

    const patientSideEffects = (patientResponses[2]?.text || "").toLowerCase();

    // Analyze severity of side effects
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

    conversationContext.push({ role: "assistant", content: sideEffectPrompt });
    conversationContext.push({
      role: "user",
      content: patientResponses[2]?.text || "No",
    });

    steps.push({
      stepNumber: 2,
      action: "check_side_effects",
      aiPrompt: sideEffectPrompt,
      patientResponse: patientResponses[2]?.text || "No response",
      outcome: sideEffectOutcome,
    });

    // If severe side effects, escalate immediately with AI-generated concern
    if (escalateToDoctor) {
      const escalationResponse = await this.aiService.generateFollowupResponse({
        ...baseContext,
        step: "escalate",
        instruction: `The patient reported severe side effects: "${patientResponses[2]?.text}". Express genuine concern. Tell them this needs immediate attention from their doctor. Say you'll flag this as urgent and have clinical staff call back within the hour. Advise them to call 000 or go to emergency if symptoms worsen. Ask for a good callback number.`,
        conversationHistory: conversationContext,
        urgent: true,
      });

      const escalationPrompt =
        escalationResponse.text ||
        "I'm quite concerned about what you're describing. These symptoms really need attention from your doctor right away. I'm going to flag this as urgent and have someone from our clinical team call you back within the hour. In the meantime, if you feel worse or have any trouble breathing, please call 000 or head to your nearest emergency department. What's the best number to reach you on?";

      steps.push({
        stepNumber: 3,
        action: "escalate_to_clinician",
        aiPrompt: escalationPrompt,
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

    // Step 3: Check Adherence - AI asks based on previous context
    const adherenceResponse = await this.aiService.generateFollowupResponse({
      ...baseContext,
      step: "check_adherence",
      instruction: hasSideEffects
        ? "Acknowledge their side effects and note you'll pass that on. Then ask if they've been taking the medication as prescribed - once daily in the morning."
        : "That's reassuring to hear. Now ask if they've been able to take the medication as prescribed - once daily in the morning.",
      conversationHistory: conversationContext,
    });

    const adherencePrompt =
      adherenceResponse.text ||
      (hasSideEffects
        ? "I've made a note of that for your care team. Now, have you been able to take the medication as prescribed — once daily in the morning?"
        : "That's good to hear. Have you been taking it as prescribed — once daily in the morning?");

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

    conversationContext.push({ role: "assistant", content: adherencePrompt });
    conversationContext.push({
      role: "user",
      content: patientResponses[3]?.text || "No response",
    });

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

    // Step 4: Probe Reason (conditional - only if adherence issues)
    if (hasAdherenceIssue) {
      const probeResponse = await this.aiService.generateFollowupResponse({
        ...baseContext,
        step: "probe_reason",
        instruction: `The patient said they missed doses: "${patientResponses[3]?.text}". Respond with understanding (no judgment). Gently ask what made it difficult - was it forgetting, side effects, running out of medication, or something else?`,
        conversationHistory: conversationContext,
      });

      const probePrompt =
        probeResponse.text ||
        "That's completely understandable — starting a new medication can be an adjustment. Can you tell me a bit about what made it tricky? Was it forgetting, side effects bothering you, or something else?";

      conversationContext.push({ role: "assistant", content: probePrompt });
      conversationContext.push({
        role: "user",
        content: patientResponses[4]?.text || "No response",
      });

      steps.push({
        stepNumber: 4,
        action: "probe_reason",
        aiPrompt: probePrompt,
        patientResponse: patientResponses[4]?.text || "No response",
        outcome: "reason_identified",
      });
      flags.push("adherence_issue_identified");
    }

    // Step 5: Closing - AI generates appropriate closing based on conversation
    let closingInstruction;
    if (flags.length === 0) {
      closingInstruction =
        "Everything sounds positive! Thank them, say you'll note they're doing well, mention the team will check in again in a few weeks. Wish them well.";
    } else if (hasAdherenceIssue) {
      closingInstruction = `They had adherence issues (reason: "${
        patientResponses[4]?.text || "forgot"
      }"). Thank them for being honest. Say you'll share this with their care team to help find a routine that works. Someone will be in touch by ${followupDate}. Ask if there's anything else to pass along.`;
    } else {
      closingInstruction = `Note any concerns mentioned. Thank them for the information. Say someone from clinical staff will follow up by ${followupDate}. Ask if there's anything else they'd like you to pass along.`;
    }

    const closingResponse = await this.aiService.generateFollowupResponse({
      ...baseContext,
      step: "closing",
      instruction: closingInstruction,
      conversationHistory: conversationContext,
      followupDate,
    });

    const closingPrompt =
      closingResponse.text ||
      (flags.length === 0
        ? "That's wonderful to hear! It sounds like you're managing really well. I'll make a note of that. Our team will check in again in a few weeks. Take care of yourself!"
        : `Thank you so much for sharing all of that with me. I'll pass this along to your care team so they can support you. Someone will be in touch by ${followupDate}. Is there anything else you'd like me to let them know?`);

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
      followupDate,
    };
  }

  // Helper to map intent to action
  _mapIntentToAction(intent) {
    const mapping = {
      book_appointment: "appointment_booking_initiated",
      cancel_appointment: "cancellation_initiated",
      reschedule_appointment: "reschedule_initiated",
      clinic_info: "info_provided",
      followup: "followup_handled",
      general_inquiry: "inquiry_handled",
    };
    return mapping[intent] || "assisted";
  }

  // Get step instructions for AI
  _getStepInstructions(templateStep) {
    const instructions = {
      verify_identity:
        "Ask the patient to confirm their name and date of birth for verification.",
      ask_question:
        templateStep.question || "Ask the relevant health question.",
      probe_reason: "Gently ask why they had difficulty with the medication.",
      close_and_flag:
        "Thank them and let them know when the clinic will follow up.",
    };
    return (
      instructions[templateStep.action] ||
      "Continue the conversation naturally."
    );
  }

  // Get default prompt if AI fails
  _getDefaultPrompt(templateStep) {
    const defaults = {
      verify_identity:
        "To confirm I'm speaking with the right person, could you please tell me your name and date of birth?",
      ask_question: templateStep.question || "How have you been feeling?",
      probe_reason: "Can you tell me more about what made it difficult?",
      close_and_flag:
        "Thank you for sharing that with me. A member of our team will be in touch within the next few days to follow up.",
    };
    return defaults[templateStep.action] || "Thank you for that information.";
  }

  // Determine outcome based on AI analysis
  _determineOutcome(templateStep, patientResponse, aiFollowup) {
    if (!patientResponse?.text) return "no_response";
    if (aiFollowup.flagConcern)
      return `concern_identified_${aiFollowup.concernType}`;
    if (templateStep.action === "verify_identity") return "identity_verified";
    return "completed_successfully";
  }

  // Private helper methods

  _isBusinessHours(config, currentTime) {
    const now = new Date(currentTime);
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const day = days[now.getDay()];

    const schedule = config.operating_hours?.schedule?.[day];
    if (!schedule?.is_open) return false;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMin] = schedule.start.split(":").map(Number);
    const [endHour, endMin] = schedule.end.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  _classifyCall(config, message, intent) {
    const lowerMessage = message?.toLowerCase() || "";
    const classification = config.call_classification;

    // Check voicemail triggers
    if (
      classification?.voicemail_triggers?.some((t) =>
        lowerMessage.includes(t.toLowerCase()),
      )
    ) {
      return "voicemail";
    }

    // Check escalation triggers
    if (
      classification?.escalation_triggers?.keywords?.some((k) =>
        lowerMessage.includes(k.toLowerCase()),
      )
    ) {
      return "escalation";
    }

    // Check followup identifiers
    if (
      classification?.followup_identifiers?.some((f) =>
        lowerMessage.includes(f.toLowerCase()),
      )
    ) {
      return "followup";
    }

    return "general";
  }

  _shouldEscalate(config, message, intent) {
    const escalationTriggers = config.call_classification?.escalation_triggers;
    if (!escalationTriggers) return false;

    const lowerMessage = message?.toLowerCase() || "";
    return escalationTriggers.keywords?.some((k) =>
      lowerMessage.includes(k.toLowerCase()),
    );
  }

  _isEmergency(config, message) {
    const emergencyKeywords =
      config.agent_persona?.safety_enforcement?.emergency_keywords || [];
    const lowerMessage = message?.toLowerCase() || "";
    return emergencyKeywords.some((k) =>
      lowerMessage.includes(k.toLowerCase()),
    );
  }

  _isWithinScope(config, intent) {
    const allowedActions = config.ai_scope?.allowed_actions || [];
    return allowedActions.includes(intent);
  }

  _generateGreeting(tone, clinicName) {
    const greetings = {
      empathetic: `Hello, thank you for calling ${clinicName}. I'm here to help you today. How are you doing?`,
      professional: `Good day, you've reached ${clinicName}. How may I assist you?`,
      friendly: `Hi there! Thanks for calling ${clinicName}. What can I help you with today?`,
      formal: `Thank you for contacting ${clinicName}. How may I direct your call?`,
    };
    return greetings[tone] || greetings.professional;
  }

  async _attemptResolution(config, intent, message) {
    // Simulate resolution attempts based on intent
    const resolutions = {
      book_appointment: {
        success: true,
        response:
          "I can help you book an appointment. Let me check our available times. What day works best for you?",
        actionTaken: "appointment_booking_initiated",
      },
      cancel_appointment: {
        success: true,
        response:
          "I can help you cancel your appointment. Can you confirm your name and date of birth for verification?",
        actionTaken: "cancellation_initiated",
      },
      provide_clinic_info: {
        success: true,
        response: "I'd be happy to provide that information.",
        actionTaken: "info_provided",
      },
      general_inquiry: {
        success: false,
        response: "Let me see how I can help with that.",
        actionTaken: "needs_clarification",
      },
    };

    return resolutions[intent] || resolutions.general_inquiry;
  }

  _processFollowupStep(templateStep, patientResponse, config) {
    const response = patientResponse?.text?.toLowerCase() || "";

    switch (templateStep.action) {
      case "verify_identity":
        return {
          aiPrompt: `To confirm I'm speaking with the right person, could you please tell me your ${templateStep.prompts?.join(
            " and ",
          )}?`,
          outcome: patientResponse
            ? "identity_verified"
            : "verification_failed",
          endCall:
            !patientResponse && templateStep.on_failure === "end_call_politely",
        };

      case "ask_question":
        const hasIssue =
          response.includes("yes") || response.includes("problem");
        return {
          aiPrompt: templateStep.question,
          outcome: hasIssue ? "issue_reported" : "no_issues",
          flag:
            hasIssue && templateStep.flag_if === "yes"
              ? `issue_at_step_${templateStep.step}`
              : null,
        };

      case "probe_reason":
        const matchesTrigger = templateStep.triggers?.some((t) =>
          response.includes(t.toLowerCase()),
        );
        return {
          aiPrompt: templateStep.question,
          outcome: matchesTrigger ? "reason_identified" : "reason_unclear",
          flag: matchesTrigger ? "adherence_issue_identified" : null,
        };

      case "close_and_flag":
        const followupDate = this._calculateFollowupDate(
          templateStep.set_expectation?.default_days || 3,
        );
        return {
          aiPrompt:
            templateStep.set_expectation?.message?.replace(
              "{{followup_date}}",
              followupDate,
            ) || `A member of our team will be in touch by ${followupDate}.`,
          outcome: "call_completed",
          flag: templateStep.flag_for_review
            ? "requires_clinician_review"
            : null,
        };

      default:
        return {
          aiPrompt: "How can I help you further?",
          outcome: "unknown_action",
        };
    }
  }

  _generateFollowupSummary(template, steps, flags) {
    return {
      templateName: template.name,
      totalSteps: template.steps.length,
      completedSteps: steps.length,
      issuesIdentified: flags.filter((f) => f.includes("issue")).length,
      requiresReview: flags.includes("requires_clinician_review"),
      adherenceStatus: flags.includes("adherence_issue_identified")
        ? "concerns"
        : "ok",
    };
  }

  _calculateFollowupDate(daysFromNow) {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toLocaleDateString("en-AU", { month: "long", day: "numeric" });
  }
}

module.exports = CallSimulator;
