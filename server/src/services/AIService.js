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
   * Generate a conversational response based on context
   * @param {string} prompt - The user's input (often just a trigger, real instruction in context)
   * @param {object} context - Conversation context including clinic config and instruction
   * @returns {Promise<object>} AI response with text and metadata
   */
  async generateResponse(prompt, context) {
    const clinicConfig = context?.clinicConfig || {};
    const instruction = context?.instruction || "";
    const conversationHistory = context?.conversationHistory || "";
    // Use explicitly passed tone, or fall back to config, or default
    const tone =
      context?.tone ||
      clinicConfig.agent_persona?.tone_preference ||
      "professional and friendly";

    try {
      // Build a more targeted system prompt that includes the specific instruction
      const historySection = conversationHistory
        ? `\n\nCONVERSATION SO FAR:\n${conversationHistory}\n`
        : "";

      const systemPrompt = `You are Heidi, a friendly AI phone assistant for ${clinicConfig.clinic_name || "the clinic"}.
Your tone: ${tone}

IMPORTANT: Your tone should be ${tone}. This means your responses should reflect a ${tone} manner of speaking.

CURRENT STATUS: ${context?.isBusinessHours ? "Open (Business Hours)" : "Closed (After Hours)"}${historySection}

CRITICAL RULES:
- You CANNOT provide medical advice, diagnose symptoms, or change prescriptions
- For emergencies (chest pain, difficulty breathing, severe bleeding), immediately direct to call 000
- Be empathetic but efficient
- Keep responses concise (1-3 sentences max)
- STAY CONSISTENT with anything you already said in the conversation
- If you offered specific times/options, reference those exact same times when confirming
- ALWAYS maintain a ${tone} tone throughout your response

YOUR SPECIFIC TASK RIGHT NOW:
${instruction}

Respond naturally as Heidi with a ${tone} tone. Output ONLY what you would say - no explanations, no prefixes like "Heidi:", just the spoken words.`;

      // Call LM Studio directly
      const response = await this._chatCompletion(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: instruction || prompt },
        ],
        { temperature: 0.6, max_tokens: 256 },
      );

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

    // Default tone if not provided
    const effectiveTone = tone || "empathetic";

    try {
      // Build the system prompt for followup calls
      const systemPrompt = `You are Heidi, a caring and professional digital care partner for ${clinicName}.
You are making an OUTBOUND follow-up call about blood pressure medication (Zestril).

PERSONALITY & TONE:
- Your tone MUST be: ${effectiveTone}
- This means you should sound ${effectiveTone} in every response
- Be warm and caring, but efficient
- Never give medical advice or diagnose
- If patient reports severe symptoms, express genuine concern and escalate

YOUR TASK FOR THIS STEP:
${instruction}

RULES:
- Keep responses conversational and natural (2-3 sentences max)
- Acknowledge what the patient says before moving on
- Use the patient's name if they've given it
- Be human and warm, not robotic
- ALWAYS maintain a ${effectiveTone} tone
${
  urgent
    ? "- This is urgent - express genuine concern and prioritize patient safety"
    : ""
}
${followupDate ? `- The follow-up date is ${followupDate}` : ""}

Respond ONLY with what Heidi would say out loud in a ${effectiveTone} tone - no explanations, no JSON, just the natural spoken response.`;

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
        content: `Now, based on the conversation so far, say your next line as Heidi using a ${effectiveTone} tone. Remember: ${instruction}`,
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
   * Check if the service is properly configured
   * @returns {boolean} Whether LM Studio is expected to be available
   */
  isConfigured() {
    // LM Studio doesn't need API keys, just needs to be running
    return true;
  }
}

module.exports = AIService;
