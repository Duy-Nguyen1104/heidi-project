const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");

// In-memory storage (replace with database in production)
const clinicConfigs = new Map();

// Create new clinic configuration
router.post("/", (req, res) => {
  const clinicId = `clinic_${uuidv4().slice(0, 8)}`;
  const config = {
    clinic_id: clinicId,
    created_at: new Date().toISOString(),
    ...req.body,
  };

  clinicConfigs.set(clinicId, config);
  res.status(201).json(config);
});

// Get clinic configuration
router.get("/:clinicId", (req, res) => {
  const config = clinicConfigs.get(req.params.clinicId);
  if (!config) {
    return res.status(404).json({ error: "Clinic not found" });
  }
  res.json(config);
});

// Update clinic configuration
router.put("/:clinicId", (req, res) => {
  const { clinicId } = req.params;
  if (!clinicConfigs.has(clinicId)) {
    return res.status(404).json({ error: "Clinic not found" });
  }

  const updated = {
    ...clinicConfigs.get(clinicId),
    ...req.body,
    updated_at: new Date().toISOString(),
  };

  clinicConfigs.set(clinicId, updated);
  res.json(updated);
});

// Get all clinic configurations (for demo purposes)
router.get("/", (req, res) => {
  res.json(Array.from(clinicConfigs.values()));
});

module.exports = router;
