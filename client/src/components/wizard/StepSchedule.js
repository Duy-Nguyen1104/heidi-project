import React, { forwardRef, useImperativeHandle } from "react";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const StepSchedule = forwardRef(({ config, updateConfig, showErrors }, ref) => {
  const schedule = config.operating_hours?.schedule || {};
  const hasOpenDay = Object.values(schedule).some((day) => day?.is_open);
  const scheduleError = !hasOpenDay
    ? "At least one day must be marked as open"
    : null;

  useImperativeHandle(ref, () => ({
    validate: () => hasOpenDay,
  }));

  const updateDay = (day, field, value) => {
    const updatedSchedule = {
      ...schedule,
      [day]: { ...schedule[day], [field]: value },
    };
    updateConfig({
      operating_hours: { ...config.operating_hours, schedule: updatedSchedule },
    });
  };

  const applyWeekdaySchedule = () => {
    const mondaySchedule = schedule.monday || {
      start: "08:00",
      end: "18:00",
      is_open: true,
    };
    const updatedSchedule = { ...schedule };
    ["tuesday", "wednesday", "thursday", "friday"].forEach((day) => {
      updatedSchedule[day] = { ...mondaySchedule };
    });
    updateConfig({
      operating_hours: { ...config.operating_hours, schedule: updatedSchedule },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tighter text-charcoal">
          Operating Hours
        </h2>
        <p className="mt-2 text-slate-600">
          Tell us when your clinic is open. Heidi will handle calls differently
          during business hours vs. after hours.
        </p>
      </div>

      <div
        className={`bg-slate-50 rounded-xl p-4 ${
          showErrors && scheduleError ? "ring-2 ring-red-300" : ""
        }`}
      >
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_30px_100px_60px] gap-2 pb-3 border-b border-slate-200 text-sm font-medium text-slate-500">
          <span>Day</span>
          <span>Opens</span>
          <span></span>
          <span>Closes</span>
          <span className="text-center">Open?</span>
        </div>

        {/* Days */}
        {DAYS.map((day) => (
          <div
            key={day}
            className="grid grid-cols-[1fr_100px_30px_100px_60px] gap-2 py-3 border-b border-slate-100 last:border-0 items-center"
          >
            <span className="font-medium text-charcoal capitalize">{day}</span>
            <input
              type="time"
              value={schedule[day]?.start || "08:00"}
              onChange={(e) => updateDay(day, "start", e.target.value)}
              disabled={!schedule[day]?.is_open}
              className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal disabled:opacity-50 disabled:bg-slate-100"
            />
            <span className="text-center text-slate-400 text-sm">to</span>
            <input
              type="time"
              value={schedule[day]?.end || "18:00"}
              onChange={(e) => updateDay(day, "end", e.target.value)}
              disabled={!schedule[day]?.is_open}
              className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-charcoal disabled:opacity-50 disabled:bg-slate-100"
            />
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={schedule[day]?.is_open || false}
                onChange={(e) => updateDay(day, "is_open", e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-charcoal focus:ring-charcoal"
              />
            </div>
          </div>
        ))}
      </div>

      {showErrors && scheduleError && (
        <p className="field-error">{scheduleError}</p>
      )}

      <button
        className="btn btn-secondary btn-small"
        onClick={applyWeekdaySchedule}
      >
        Apply Monday hours to all weekdays
      </button>

      <div>
        <label className="label">Public Holidays</label>
        <select
          value={
            config.operating_hours?.public_holiday_mode || "after_hours_logic"
          }
          onChange={(e) =>
            updateConfig({
              operating_hours: {
                ...config.operating_hours,
                public_holiday_mode: e.target.value,
              },
            })
          }
          className="input"
        >
          <option value="after_hours_logic">
            Treat as after-hours (recommended)
          </option>
          <option value="closed">Fully closed (voicemail only)</option>
          <option value="business_hours_logic">
            Treat as normal business hours
          </option>
        </select>
        <p className="text-sm text-slate-500 mt-1">
          Heidi automatically recognizes Australian public holidays.
        </p>
      </div>

      <div className="bg-sunlight/30 border border-sunlight rounded-xl p-4">
        <p className="font-medium text-charcoal">⏰ What this means</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>
            <strong>During business hours:</strong> Heidi will try to resolve
            requests (bookings, info) and can transfer to staff
          </li>
          <li>
            <strong>After hours:</strong> Heidi will take messages and only
            escalate true emergencies
          </li>
        </ul>
      </div>
    </div>
  );
});

export default StepSchedule;
