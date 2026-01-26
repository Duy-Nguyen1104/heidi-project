/**
 * AI Service - Direct HTTP Integration with Local LLM (LM Studio)
 *
 * This service uses direct HTTP calls to LM Studio's OpenAI-compatible API
 * for natural language processing and conversation handling.
 *
 * LM Studio runs locally at http://localhost:1234/v1
 */

const fetch = require("node-fetch");

class AIService {
  constructor() {
    this.lmStudioBaseUrl =
      process.env.LM_STUDIO_URL || "http://127.0.0.1:1234/v1";
    this.modelName = process.env.LM_STUDIO_MODEL || "openai/gpt-oss-20b";
    console.log(
      `[AI] Configured for LM Studio at ${this.lmStudioBaseUrl} with model ${this.modelName}`,
    );

    // Initialize prompt templates for different scenarios
    this._initializePromptTemplates();
  }

  /**
   * Make a chat completion request to LM Studio
   * @param {Array} messages - Array of {role, content} message objects
   * @param {object} options - Optional parameters (temperature, max_tokens)
   * @returns {Promise<string>} The assistant's response text
   */
  async _chatCompletion(messages, options = {}) {
    const url = `${this.lmStudioBaseUrl}/chat/completions`;
    console.log(`[AI] Calling LM Studio at: ${url}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 512,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LM Studio error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log(`[AI] LM Studio responded successfully`);
      return data.choices?.[0]?.message?.content || "";
    } catch (error) {
      console.error(`[AI] LM Studio connection error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize prompt templates for various call handling scenarios
   * Now stored as template strings instead of LangChain PromptTemplates
   */
  _initializePromptTemplates() {
    // Main conversation prompt for clinic calls
    this.clinicCallPromptTemplate = `You are a friendly and professional AI assistant for {clinicName}, a medical clinic.
Your tone should be {tone}.

IMPORTANT RULES:
- You CANNOT provide medical advice, diagnose symptoms, or change prescriptions
- For emergencies (chest pain, difficulty breathing, severe bleeding), immediately direct to call 000
- Be empathetic but efficient
- If you cannot help, offer to take a message or transfer to staff

CLINIC CONTEXT:
- Clinic Name: {clinicName}
- Current Status: {businessStatus}
- Available Actions: {allowedActions}

CALLER'S MESSAGE: {callerMessage}

Respond naturally as the clinic's phone assistant. Keep responses concise (1-3 sentences).`;

    // Follow-up call prompt for medication check-ins
    this.followupCallPromptTemplate = `You are conducting an outbound follow-up call for {clinicName} regarding {medicationType} medication.
Your tone should be caring and professional.

CURRENT STEP: {currentStep}
STEP INSTRUCTIONS: {stepInstructions}

PATIENT'S RESPONSE: {patientResponse}

CONVERSATION HISTORY:
{conversationHistory}

Based on the patient's response:
1. Acknowledge what they said
2. Determine if there are any concerns to flag (side effects, missed doses, etc.)
3. Provide the appropriate next response or transition to the next step

Respond in JSON format only:
{
  "response": "your spoken response to the patient",
  "flagConcern": true or false,
  "concernType": "side_effect" or "adherence" or "other" or "none",
  "concernDetails": "brief description if flagged, empty string otherwise",
  "proceedToNext": true or false
}`;
  }

  /**
   * Format a template string with values
   */
  _formatTemplate(template, values) {
    let result = template;
    for (const [key, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
    return result;
  }

  /**
   * Generate a conversational response based on context
   * @param {string} prompt - The user's input
   * @param {object} context - Conversation context including clinic config
   * @returns {Promise<object>} AI response with text and metadata
   */
  async generateResponse(prompt, context) {
    const clinicConfig = context?.clinicConfig || {};

    try {
      // Format the prompt
      const formattedPrompt = this._formatTemplate(
        this.clinicCallPromptTemplate,
        {
          clinicName: clinicConfig.clinic_name || "the clinic",
          tone:
            clinicConfig.agent_persona?.tone_preference ||
            "professional and friendly",
          businessStatus: context?.isBusinessHours
            ? "Open (Business Hours)"
            : "Closed (After Hours)",
          allowedActions:
            (clinicConfig.ai_scope?.allowed_actions || []).join(", ") ||
            "take messages, provide clinic info",
          callerMessage: prompt,
        },
      );

      // Call LM Studio directly
      const response = await this._chatCompletion([
        { role: "system", content: formattedPrompt },
        { role: "user", content: prompt },
      ]);

      // Use local intent detection to avoid extra API calls
      const intent = this._detectIntentLocally(prompt);

      console.log(
        "[AI] Generated response for:",
        prompt.substring(0, 50) + "...",
      );

      return {
        text: response.trim(),
        confidence: 0.9,
        intent,
        entities: [],
        metadata: {
          model: this.modelName,
          provider: "lm-studio",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("[AI] Error generating response:", error.message);

      // Fallback to mock response on error
      return this._generateMockResponse(prompt, clinicConfig);
    }
  }

  /**
   * Generate a dynamic response for outbound follow-up calls
   * Uses conversation history and context to create natural, contextual responses
   * @param {object} context - Call context with step info, conversation history, etc.
   * @returns {Promise<object>} AI response with text
   */
  async generateFollowupResponse(context) {
    const {
      clinicName,
      tone,
      step,
      instruction,
      conversationHistory,
      urgent,
      followupDate,
    } = context;

    try {
      // Build the system prompt for followup calls
      const systemPrompt = `You are Heidi, a caring and professional digital care partner for ${clinicName}.
You are making an OUTBOUND follow-up call about blood pressure medication (Zestril).

PERSONALITY:
- Tone: ${tone || "empathetic"} but professional
- Warm and caring, but efficient
- Never give medical advice or diagnose
- If patient reports severe symptoms, express genuine concern and escalate

YOUR TASK FOR THIS STEP:
${instruction}

RULES:
- Keep responses conversational and natural (2-3 sentences max)
- Acknowledge what the patient says before moving on
- Use the patient's name if they've given it
- Be human and warm, not robotic
${
  urgent
    ? "- This is urgent - express genuine concern and prioritize patient safety"
    : ""
}
${followupDate ? `- The follow-up date is ${followupDate}` : ""}

Respond ONLY with what Heidi would say out loud - no explanations, no JSON, just the natural spoken response.`;

      // Build messages array with conversation history
      const messages = [{ role: "system", content: systemPrompt }];

      // Add conversation history for context
      if (conversationHistory && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          messages.push({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
          });
        }
      }

      // Add the instruction as the final user message to prompt the AI
      messages.push({
        role: "user",
        content: `Now, based on the conversation so far, say your next line as Heidi. Remember: ${instruction}`,
      });

      const response = await this._chatCompletion(messages, {
        temperature: 0.8, // Slightly higher for more natural variation
        max_tokens: 256,
      });

      console.log(`[AI] Generated followup response for step: ${step}`);

      // Clean up the response (remove quotes if wrapped)
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('"') && cleanedResponse.endsWith('"')) {
        cleanedResponse = cleanedResponse.slice(1, -1);
      }

      return {
        text: cleanedResponse,
        step,
        metadata: {
          model: this.modelName,
          provider: "lm-studio",
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("[AI] Error generating followup response:", error.message);
      // Return null to signal fallback should be used
      return { text: null, step, error: error.message };
    }
  }

  /**
   * Simple local intent detection without API call
   */
  _detectIntentLocally(message) {
    const lower = message.toLowerCase();

    if (
      /emergency|urgent|chest pain|can't breathe|severe|ambulance/i.test(lower)
    ) {
      return "emergency";
    }
    if (/book|appointment|schedule|see (the |a )?doctor/i.test(lower)) {
      return "book_appointment";
    }
    if (/cancel/i.test(lower)) {
      return "cancel_appointment";
    }
    if (/reschedule|change.*appointment|move.*appointment/i.test(lower)) {
      return "reschedule_appointment";
    }
    if (/message|voicemail|call.*back/i.test(lower)) {
      return "leave_message";
    }
    if (/speak|talk|human|person|staff|reception/i.test(lower)) {
      return "speak_to_human";
    }
    if (/hours|open|location|address|where|when/i.test(lower)) {
      return "clinic_info";
    }

    return "general_inquiry";
  }

  /**
   * Analyze sentiment of patient response using AI
   * @param {string} text - Text to analyze
   * @returns {Promise<object>} Sentiment analysis result
   */
  async analyzeSentiment(text) {
    try {
      const prompt = `Analyze the sentiment of this message from a medical clinic caller.
Rate the sentiment and provide a brief analysis.

Message: "${text}"

Respond in JSON format only, no other text:
{"sentiment": "positive" or "negative" or "neutral", "score": number from -1 to 1, "magnitude": number from 0 to 1, "reason": "brief explanation"}`;

      const response = await this._chatCompletion([
        { role: "user", content: prompt },
      ]);

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: parsed.score || 0,
          magnitude: parsed.magnitude || 0.5,
          sentiment: parsed.sentiment || "neutral",
          reason: parsed.reason || "",
        };
      }

      return { score: 0, magnitude: 0.5, sentiment: "neutral" };
    } catch (error) {
      console.error("[AI] Sentiment analysis error:", error.message);
      return {
        score: 0,
        magnitude: 0.5,
        sentiment: "neutral",
        error: error.message,
      };
    }
  }

  /**
   * Detect intent from caller message using AI
   * @param {string} message - Caller's message
   * @returns {Promise<string>} Detected intent
   */
  async _detectIntent(message) {
    // Use local detection for efficiency
    return this._detectIntentLocally(message);
  }

  /**
   * Extract entities from caller message using AI
   * @param {string} message - Caller's message
   * @returns {Promise<Array>} Extracted entities
   */
  async _extractEntities(message) {
    try {
      const prompt = `Extract relevant entities from this caller's message for a medical clinic context.

Message: "${message}"

Extract these entity types if present:
- date: Any mentioned date or day
- time: Any mentioned time
- doctor: Doctor name mentioned
- symptom: Any symptoms mentioned (but do NOT diagnose)
- phone: Phone number
- name: Person's name

Respond in JSON format only, no other text:
{"entities": [{"type": "entity_type", "value": "extracted_value"}]}

If no entities found, respond with: {"entities": []}`;

      const response = await this._chatCompletion([
        { role: "user", content: prompt },
      ]);

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.entities || [];
      }

      return [];
    } catch (error) {
      console.error("[AI] Entity extraction error:", error.message);
      return [];
    }
  }

  /**
   * Generate response for follow-up call steps
   * @param {object} params - Follow-up call parameters
   * @returns {Promise<object>} Follow-up response with flags
   */
  async generateFollowupResponse(params) {
    const {
      clinicName,
      medicationType,
      currentStep,
      stepInstructions,
      patientResponse,
      conversationHistory,
    } = params;

    try {
      const formattedPrompt = this._formatTemplate(
        this.followupCallPromptTemplate,
        {
          clinicName: clinicName || "the clinic",
          medicationType: medicationType || "prescribed",
          currentStep: currentStep || "general",
          stepInstructions:
            stepInstructions || "Continue the conversation naturally",
          patientResponse: patientResponse || "",
          conversationHistory: conversationHistory || "Start of call",
        },
      );

      const response = await this._chatCompletion([
        { role: "system", content: formattedPrompt },
        { role: "user", content: patientResponse || "Hello" },
      ]);

      // Parse the JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          response: parsed.response || "Thank you for that information.",
          flagConcern: parsed.flagConcern || false,
          concernType: parsed.concernType || "none",
          concernDetails: parsed.concernDetails || "",
          proceedToNext: parsed.proceedToNext !== false,
        };
      }

      return {
        response: "Thank you for sharing that with me.",
        flagConcern: false,
        concernType: "none",
        concernDetails: "",
        proceedToNext: true,
      };
    } catch (error) {
      console.error("[AI] Follow-up response error:", error.message);
      return this._generateMockFollowupResponse(params);
    }
  }

  /**
   * Generate mock follow-up response when AI is unavailable
   */
  _generateMockFollowupResponse(params) {
    const { patientResponse, currentStep } = params;
    const lower = (patientResponse || "").toLowerCase();

    // Check for concerning responses
    let flagConcern = false;
    let concernType = "none";
    let concernDetails = "";

    if (
      /dizzy|nausea|headache|pain|sick|tired|fatigue|side effect/i.test(lower)
    ) {
      flagConcern = true;
      concernType = "side_effect";
      concernDetails = "Patient reported potential side effects";
    } else if (/forgot|missed|skip|didn't take|haven't taken/i.test(lower)) {
      flagConcern = true;
      concernType = "adherence";
      concernDetails = "Patient may have missed doses";
    }

    const responses = {
      greeting:
        "Hello! This is a follow-up call from the clinic regarding your medication. How have you been feeling?",
      medication_check:
        "Thank you for letting me know. Have you been taking your medication as prescribed?",
      side_effects:
        "I appreciate you sharing that. Have you experienced any unusual symptoms or side effects?",
      closing:
        "Thank you for your time today. If you have any concerns, please don't hesitate to contact the clinic. Take care!",
      general:
        "Thank you for that information. Is there anything else you'd like to share about how you're doing?",
    };

    return {
      response: responses[currentStep] || responses.general,
      flagConcern,
      concernType,
      concernDetails,
      proceedToNext: true,
      metadata: {
        model: "mock-fallback",
        reason: "LM Studio unavailable",
      },
    };
  }

  /**
   * Transcribe audio to text (placeholder - would need Google Speech-to-Text)
   * @param {Buffer} audioBuffer - Audio data
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioBuffer) {
    // Note: LangChain doesn't directly support speech-to-text
    // This would require @google-cloud/speech integration
    console.log(
      "[GoogleAI] Audio transcription requires Google Speech-to-Text API",
    );
    return "[Audio transcription not implemented - requires Google Speech-to-Text API]";
  }

  /**
   * Synthesize speech from text (placeholder - would need Google Text-to-Speech)
   * @param {string} text - Text to convert to speech
   * @param {object} options - Voice options (language, gender, etc.)
   * @returns {Promise<Buffer>} Audio buffer
   */
  async synthesizeSpeech(text, options = {}) {
    // Note: LangChain doesn't directly support text-to-speech
    // This would require @google-cloud/text-to-speech integration
    console.log(
      "[GoogleAI] Speech synthesis requires Google Text-to-Speech API",
    );
    return Buffer.from("audio-placeholder");
  }

  /**
   * Check if the service is properly configured
   * @returns {boolean} Whether LM Studio is expected to be available
   */
  isConfigured() {
    // LM Studio doesn't need API keys, just needs to be running
    return true;
  }
}

module.exports = AIService;
