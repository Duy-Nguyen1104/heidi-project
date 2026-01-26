const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables before importing routes
dotenv.config();

const clinicRoutes = require("./routes/clinicRoutes");
const simulationRoutes = require("./routes/simulationRoutes");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/clinics", clinicRoutes);
app.use("/api/simulate", simulationRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Heidi Calls API is running on http://localhost:${PORT}`);
});
