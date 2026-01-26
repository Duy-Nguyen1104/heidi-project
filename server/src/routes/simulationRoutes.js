const express = require("express");
const router = express.Router();
const GoogleAIService = require("../services/googleAIService");
const CallSimulator = require("../services/callSimulator");

const aiService = new GoogleAIService();
const simulator = new CallSimulator();

// Simulate an inbound call based on clinic config
router.post("/inbound", async (req, res) => {
  const { clinicConfig, callContext } = req.body;

  try {
    const result = await simulator.simulateInboundCall(
      clinicConfig,
      callContext
    );
    res.json(result);
  } catch (error) {
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
      patientResponses
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate AI response (placeholder for Google AI)
router.post("/ai-response", async (req, res) => {
  const { prompt, context } = req.body;

  try {
    const response = await aiService.generateResponse(prompt, context);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
