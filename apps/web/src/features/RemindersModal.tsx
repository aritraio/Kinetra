import { useState } from 'react';
import { Button, Dialog, Field, Notice } from '../components/ui';
import {
  type ReminderItem,
  type ReminderPreferences,
  getReminderPreferences,
  saveReminderPreferences,
} from './reminders';

export interface RemindersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RemindersModal({ isOpen, onClose }: RemindersModalProps) {
  const [prefs, setPrefs] = useState<ReminderPreferences>(() => getReminderPreferences());
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    setPrefs((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    }));
  };

  const handleTimeChange = (id: string, time: string) => {
    setPrefs((prev) => ({
      ...prev,
      reminders: prev.reminders.map((r) => (r.id === id ? { ...r, time } : r)),
    }));
  };

  const handleTimezoneChange = (timezone: string) => {
    setPrefs((prev) => ({ ...prev, timezone }));
  };

  const handleSave = () => {
    saveReminderPreferences(prefs);
    setSavedStatus('Preferences saved.');
    setTimeout(() => {
      setSavedStatus(null);
      onClose();
    }, 800);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Reminders & Alerts"
      description="Configure local in-app alerts aligned with your timezone schedule."
      size="medium"
    >
      <div className="reminders-settings-body">
        {/* Honest Delivery Disclaimer */}
        <Notice variant="info" style={{ marginBottom: '20px' }}>
          <strong>Honest Delivery Policy:</strong> Web in-app reminders appear while Kinetra is open
          in your browser and upon returning after a scheduled window has elapsed. Because standard
          browsers sleep inactive tabs, reliable background push is not claimed.
        </Notice>

        <div className="field-group" style={{ marginBottom: '20px' }}>
          <Field
            label="Schedule Timezone"
            value={prefs.timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            help="Reminders trigger according to this local calendar clock."
          />
        </div>

        <div
          className="reminders-list"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {prefs.reminders.map((r: ReminderItem) => (
            <div
              key={r.id}
              className="card"
              style={{
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                border: '1px solid var(--line)',
                background: r.enabled ? 'var(--surface)' : 'var(--soft)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id={`rem-${r.id}`}
                    checked={r.enabled}
                    onChange={() => handleToggle(r.id)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor={`rem-${r.id}`}
                    style={{ fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
                  >
                    {r.title}
                  </label>
                </div>
                <p style={{ margin: '4px 0 0 28px', fontSize: '12px', color: 'var(--muted)' }}>
                  {r.action}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="time"
                  value={r.time}
                  disabled={!r.enabled}
                  onChange={(e) => handleTimeChange(r.id, e.target.value)}
                  className="field-input tabular-nums"
                  style={{ width: '110px', height: '40px', padding: '6px 10px' }}
                />
              </div>
            </div>
          ))}
        </div>

        <div
          className="actions"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '12px',
            marginTop: '24px',
          }}
        >
          {savedStatus && (
            <span style={{ fontSize: '13px', color: 'var(--muted)' }} role="status">
              {savedStatus}
            </span>
          )}
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save Preferences
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
