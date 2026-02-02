# Heidi Calls - AI Phone Assistant for Medical Clinics

A self-serve onboarding and simulation platform for Heidi Calls, an AI-powered communication product that handles inbound and outbound calls for medical clinics.

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- [LM Studio](https://lmstudio.ai/) running locally with a loaded model

### Installation

```bash
# Install all dependencies (root, client, and server)
npm run install:all
```

### Running the Application

```bash
# Start LM Studio and load a model (e.g., Llama, Mistral, etc.)
# Ensure it's running on http://127.0.0.1:1234

# Run both client and server concurrently
npm run dev
```

This will start:

- **Frontend**: http://localhost:3000 (React)
- **Backend**: http://localhost:3001 (Node.js/Express)
- **LM Studio**: http://127.0.0.1:1234 (Local LLM)

### Running Individually

```bash
# Frontend only
npm run dev:client

# Backend only
npm run dev:server
```

## Project Structure

```
heidi/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── OnboardingWizard.js    # Main wizard container
│   │   │   ├── SimulationPanel.js     # Call simulation UI
│   │   │   └── wizard/                # Step components
│   │   │       ├── StepBasicInfo.js
│   │   │       ├── StepSchedule.js
│   │   │       ├── StepStaff.js
│   │   │       ├── StepPersona.js
│   │   │       ├── StepWorkflows.js
│   │   │       └── StepReview.js
│   │   └── data/
│   │       └── defaultConfig.js       # Default configuration
│   └── public/
│
├── server/                 # Node.js backend
│   └── src/
│       ├── index.js                   # Express server
│       ├── routes/
│       │   ├── clinicRoutes.js        # Clinic CRUD API
│       │   └── simulationRoutes.js    # Call simulation API
│       ├── services/
│       │   ├── AIService.js           # LM Studio integration
│       │   └── callSimulator.js       # State machine call handler
│       └── data/
│           ├── defaultConfig.js       # Server-side defaults
│           └── clinicConfigs.json     # Persisted clinic configs
│
└── package.json            # Root package with scripts
```

## Features

### Onboarding Wizard (6 Steps)

1. **Basic Info** - Clinic name and type
2. **Operating Hours** - Business hours schedule with day/time configuration
3. **Staff Directory** - Practitioners, booking rules, and specializations
4. **Agent Persona** - Tone preference (empathetic, professional, etc.) and safety settings
5. **Workflows** - Call handling logic for business hours and after hours
6. **Review** - Configuration summary with JSON export

### Call Simulation

After completing setup, test your configuration with interactive chat-based simulations:

#### Inbound Calls

- State machine-driven conversation flow
- Configurable day/time to test business hours vs after hours
- **Immediate escalation** for emergencies and transfer requests (bypasses identity verification)
- Emergency detection and escalation
- Patient identification and intent routing
- Appointment booking with doctor preferences
- Clinical concern handling
- Message taking

#### Outbound Follow-up Calls

- Medication follow-up scenario (Zestril for blood pressure)
- AI-powered analysis of patient responses:
  - **Side effects detection** - Identifies mild vs severe symptoms
  - **Adherence analysis** - Determines if patient is taking medication consistently
  - **Non-adherence reasoning** - Categorizes reasons (forgetting, side effects, ran out, cost, etc.)
- Automatic escalation for severe symptoms
- Flag summary display at call completion

### State Machine Architecture

**Inbound Call States:**

```
[EMERGENCY_CHECK | TRANSFER_CHECK] → GREETING → IDENTIFY → TRIAGE → [APPOINTMENT_FLOW | CLINICAL_FLOW | MESSAGE_FLOW | TRANSFER_FLOW] → EXIT
```

_Note: Emergency and transfer detection occur immediately at any state and bypass normal flow progression._

**Outbound Call States:**

```
OPENING → VERIFY_IDENTITY → CHECK_SIDE_EFFECTS → CHECK_ADHERENCE → [PROBE_REASON] → CLOSING → COMPLETE
```

## LM Studio Integration

The app uses LM Studio's OpenAI-compatible API for local LLM inference:

- **Endpoint**: `http://127.0.0.1:1234/v1/chat/completions`
- **Features used**:
  - Conversational responses with configurable tone
  - Identity extraction (name/DOB parsing)
  - Intent classification
  - Side effects analysis
  - Adherence analysis
  - Non-adherence reason categorization

### Environment Variables (Optional)

```bash
LM_STUDIO_URL=http://127.0.0.1:1234/v1
LM_STUDIO_MODEL=your-model-name
```

## Configuration Data Model

See [defaultConfig.js](server/src/data/defaultConfig.js) for the complete JSON schema including:

- `operating_hours` - Schedule and holiday handling
- `staff_directory` - Practitioners and booking rules
- `agent_persona` - Tone preference and safety settings
- `ai_scope` - Allowed/forbidden actions
- `call_classification` - Routing triggers and escalation keywords
  - `escalation_triggers.keywords` - Custom keywords for immediate staff transfer
- `workflow_rules` - Business/after-hours logic
- `followup_templates` - Outbound call scripts

## Demo Scenarios

### Inbound Call Testing

- **Business hours appointment**: Set time to 10:00 on a weekday, request an appointment
- **After hours message**: Set time to 20:00, leave a message
- **Emergency detection**: Mention "chest pain" or "can't breathe" to trigger emergency response
- **Transfer request**: Say "I want to talk to a doctor" or configured escalation keywords for immediate staff transfer
- **Doctor preference**: Ask for a specific doctor to test booking rules

### Outbound Follow-up (Zestril)

1. **Normal flow**: Confirm identity → No side effects → Taking medication daily → Close
2. **Side effects flow**: Report dizziness or cough → AI acknowledges and continues
3. **Severe escalation**: Report "very dizzy and almost fainted" → Triggers urgent escalation
4. **Adherence probe**: Say "I missed a few days" → AI asks why → Categorizes reason

## Data Persistence

Clinic configurations are persisted to `server/src/data/clinicConfigs.json` for demo purposes. This survives server restarts but should be replaced with a proper database in production.
