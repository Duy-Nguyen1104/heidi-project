const express = require("express");
const router = express.Router();
const AIService = require("../services/AIService");
const CallSimulator = require("../services/callSimulator");

const aiService = new AIService();
const simulator = new CallSimulator();

// ═══════════════════════════════════════════════════════════════════════════════
// INBOUND CALL CONVERSATION ENDPOINTS (State Machine)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize a new inbound conversation
 * Returns the initial state and greeting
 */
router.post("/inbound/start", async (req, res) => {
  const { clinicConfig, callContext } = req.body;

  try {
    const conversation = await simulator.initInboundConversation(
      clinicConfig,
      callContext || { currentTime: new Date().toISOString() },
    );
    res.json(conversation);
  } catch (error) {
    console.error("Error starting inbound conversation:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process a message in an ongoing inbound conversation
 * Advances the state machine and returns the AI response
 */
router.post("/inbound/message", async (req, res) => {
  const { conversationState, patientMessage, clinicConfig } = req.body;

  try {
    const updatedState = await simulator.processInboundMessage(
      conversationState,
      patientMessage,
      clinicConfig,
    );
    res.json(updatedState);
  } catch (error) {
    console.error("Error processing inbound message:", error);
    res.status(500).json({ error: error.message });
  }
});

// Simulate an outbound follow-up call (like Zestril scenario)
router.post("/outbound-followup", async (req, res) => {
  const { clinicConfig, templateId, patientResponses } = req.body;

  try {
    const result = await simulator.simulateFollowupCall(
      clinicConfig,
      templateId,
      patientResponses,
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Initialize a new outbound follow-up conversation
 * Returns the initial state and opening message
 */
router.post("/outbound/start", async (req, res) => {
  const { clinicConfig } = req.body;

  try {
    const conversation = await simulator.initOutboundConversation(clinicConfig);
    res.json(conversation);
  } catch (error) {
    console.error("Error starting outbound conversation:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Process a message in an ongoing outbound conversation
 * Advances through the follow-up steps and returns the AI response
 */
router.post("/outbound/message", async (req, res) => {
  const { conversationState, patientMessage, clinicConfig } = req.body;

  try {
    const updatedState = await simulator.processOutboundMessage(
      conversationState,
      patientMessage,
      clinicConfig,
    );
    res.json(updatedState);
  } catch (error) {
    console.error("Error processing outbound message:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
