import React, { forwardRef, useImperativeHandle } from "react";

const StepReview = forwardRef(({ config }, ref) => {
  useImperativeHandle(ref, () => ({ validate: () => true }));

  const schedule = config.operating_hours?.schedule || {};
  const staff = config.staff_directory || [];
  const persona = config.agent_persona || {};
  const workflows = config.workflow_rules || {};

  const getOpenDays = () => {
    return Object.entries(schedule)
      .filter(([_, day]) => day.is_open)
      .map(
        ([name, day]) =>
          `${name.charAt(0).toUpperCase() + name.slice(1)} (${day.start}-${
            day.end
          })`
      )
      .join(", ");
  };

  const getAllowedActions = () => {
    return (config.ai_scope?.allowed_actions || [])
      .map((a) => a.replace(/_/g, " "))
      .join(", ");
  };

  const ReviewSection = ({ title, children }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-charcoal mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );

  const ReviewItem = ({ label, value }) => (
    <div className="flex justify-between items-baseline py-1">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="text-charcoal font-medium text-sm text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tighter text-charcoal">
          Review Your Configuration
        </h2>
        <p className="mt-2 text-slate-600">
          Here's a summary of your Heidi Calls setup. Review the details below,
          then click "Complete Setup" to activate.
        </p>
      </div>

      <div className="grid gap-4">
        <ReviewSection title="🏥 Clinic Details">
          <ReviewItem
            label="Clinic Name"
            value={config.clinic_name || "Not set"}
          />
          <ReviewItem label="Phone" value={config.clinic_phone || "Not set"} />
          <ReviewItem
            label="Practice Type"
            value={(config.practice_type || "GP").toUpperCase()}
          />
          <ReviewItem label="Timezone" value={config.timezone} />
        </ReviewSection>

        <ReviewSection title="⏰ Operating Hours">
          <ReviewItem
            label="Open Days"
            value={getOpenDays() || "None configured"}
          />
          <ReviewItem
            label="Public Holidays"
            value={
              config.operating_hours?.public_holiday_mode?.replace(/_/g, " ") ||
              "After hours logic"
            }
          />
        </ReviewSection>

        <ReviewSection title={`👥 Staff (${staff.length} practitioners)`}>
          {staff.length === 0 ? (
            <p className="text-sm text-slate-500">
              No practitioners configured
            </p>
          ) : (
            staff.map((member, i) => (
              <ReviewItem
                key={i}
                label={member.name || "Unnamed"}
                value={
                  <span>
                    {member.role}
                    {!member.booking_rules?.accepts_new_patients && (
                      <span className="text-amber-600 ml-2">
                        • No new patients
                      </span>
                    )}
                    {member.booking_rules?.requires_manual_approval && (
                      <span className="text-amber-600 ml-2">
                        • Needs approval
                      </span>
                    )}
                  </span>
                }
              />
            ))
          )}
        </ReviewSection>

        <ReviewSection title="🎭 Agent Persona">
          <ReviewItem
            label="Tone"
            value={
              <span className="capitalize">
                {persona.tone_preference || "Professional"}
              </span>
            }
          />
          <ReviewItem
            label="Emergency Action"
            value={
              persona.safety_enforcement?.emergency_action?.replace(
                /_/g,
                " "
              ) || "Hard redirect to 000"
            }
          />
          <ReviewItem
            label="Call Recording"
            value={
              persona.safety_enforcement?.record_calls ? "Enabled" : "Disabled"
            }
          />
        </ReviewSection>

        <ReviewSection title="📞 Call Handling">
          <ReviewItem
            label="Business Hours"
            value={
              workflows.business_hours_logic?.inbound_call_action?.replace(
                /_/g,
                " "
              ) || "Attempt resolution"
            }
          />
          <ReviewItem
            label="After Hours"
            value={
              workflows.after_hours_logic?.inbound_call_action?.replace(
                /_/g,
                " "
              ) || "Take message"
            }
          />
          <ReviewItem
            label="AI Can"
            value={getAllowedActions() || "Default actions"}
          />
        </ReviewSection>

        {(config.followup_templates || []).length > 0 && (
          <ReviewSection title="📋 Follow-up Templates">
            {config.followup_templates.map((template, i) => (
              <ReviewItem
                key={i}
                label={template.name}
                value={`${template.steps?.length || 0} steps • ${
                  template.trigger_type
                }`}
              />
            ))}
          </ReviewSection>
        )}
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <p className="font-medium text-emerald-800">✓ Ready to go!</p>
        <p className="text-sm text-emerald-700 mt-1">
          Click "Complete Setup" below to save your configuration. You'll then
          be able to test how Heidi handles different call scenarios.
        </p>
      </div>
    </div>
  );
});

export default StepReview;
