/**
 * Default clinic configuration - used as starting point for onboarding
 */
export const defaultConfig = {
  clinic_name: "",

  operating_hours: {
    schedule: {
      monday: { start: "08:00", end: "18:00", is_open: true },
      tuesday: { start: "08:00", end: "18:00", is_open: true },
      wednesday: { start: "08:00", end: "18:00", is_open: true },
      thursday: { start: "08:00", end: "18:00", is_open: true },
      friday: { start: "08:00", end: "17:00", is_open: true },
      saturday: { start: "09:00", end: "12:00", is_open: false },
      sunday: { start: "00:00", end: "00:00", is_open: false },
    },
    public_holiday_mode: "after_hours_logic",
  },

  staff_directory: [],

  agent_persona: {
    tone_preference: "empathetic",
    language: "en-AU",
    safety_enforcement: {
      record_calls: true,
      emergency_keywords: [
        "chest pain",
        "can't breathe",
        "suicide",
        "bleeding heavily",
        "unconscious",
      ],
      emergency_action: "hard_redirect_000",
    },
    handover_behavior: {
      phrase: "Let me connect you with our team to help further.",
      hold_music: true,
    },
  },

  ai_scope: {
    allowed_actions: [
      "book_appointment",
      "cancel_appointment",
      "reschedule_appointment",
      "take_message",
      "provide_clinic_info",
      "conduct_followup_script",
    ],
    out_of_scope: [
      "medical_advice",
      "prescription_changes",
      "test_result_interpretation",
      "diagnose_symptoms",
    ],
    fallback_action: "escalate_to_staff",
  },

  call_classification: {
    voicemail_triggers: ["leave a message", "voicemail", "call back"],
    escalation_triggers: {
      keywords: [
        "urgent",
        "emergency",
        "speak to doctor",
        "complaint",
        "not happy",
      ],
      sentiment_threshold: "negative",
      max_resolution_attempts: 2,
    },
    followup_identifiers: [
      "follow-up",
      "check-in",
      "medication review",
      "test results",
    ],
  },

  workflow_rules: {
    business_hours_logic: {
      inbound_call_action: "attempt_resolution",
      escalation_available: true,
      live_transfer_enabled: true,
    },
    after_hours_logic: {
      inbound_call_action: "take_message",
      escalation_available: false,
      emergency_only_transfer: true,
      voicemail_transcription: true,
    },
  },

  followup_templates: [
    {
      id: "medication_followup",
      name: "Medication Follow-up",
      trigger_type: "outbound",
      applicable_to: ["blood_pressure", "diabetes", "cholesterol"],
      steps: [
        {
          step: 1,
          action: "verify_identity",
          prompts: ["name", "date_of_birth"],
          on_failure: "end_call_politely",
        },
        {
          step: 2,
          action: "ask_question",
          question:
            "Have you experienced any side effects since starting the medication?",
          response_type: "yes_no_detail",
          flag_if: "yes",
        },
        {
          step: 3,
          action: "ask_question",
          question: "Have you been taking your medication as prescribed?",
          response_type: "adherence_check",
          followup_if_no: "Can you tell me more about what's been happening?",
        },
        {
          step: 4,
          action: "probe_reason",
          triggers: ["missed", "skipped", "forgot", "ran out", "stopped"],
          question: "What made it difficult to take the medication?",
        },
        {
          step: 5,
          action: "close_and_flag",
          flag_for_review: true,
          set_expectation: {
            message:
              "Thank you for sharing that with me. A member of our team will be in touch by {{followup_date}} to follow up.",
            default_days: 3,
          },
        },
      ],
    },
  ],

  defaults: {
    new_patient_booking: "requires_approval",
    unknown_clinician_request: "offer_next_available",
    ambiguous_request: "clarify_then_escalate",
    max_hold_time_seconds: 120,
    followup_days: 3,
  },
};
