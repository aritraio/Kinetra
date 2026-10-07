import type React from 'react';
import { useId } from 'react';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  unit?: string;
  help?: string;
  error?: string;
  containerClassName?: string;
}

export function Field({
  label,
  unit,
  help,
  error,
  id: explicitId,
  containerClassName = '',
  type = 'text',
  className = '',
  ...props
}: FieldProps) {
  const generatedId = useId();
  const inputId = explicitId || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const helpId = help ? `${inputId}-help` : undefined;

  return (
    <div className={`field-group ${containerClassName} ${error ? 'has-error' : ''}`}>
      <label htmlFor={inputId} className="field-label">
        <span className="field-label-text">{label}</span>
        {unit && <span className="field-unit">({unit})</span>}
      </label>
      <div className="field-input-wrapper">
        <input
          id={inputId}
          type={type}
          className={`field-input ${type === 'number' ? 'tabular-nums' : ''} ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={[errorId, helpId].filter(Boolean).join(' ') || undefined}
          {...props}
        />
        {unit && <span className="field-adornment">{unit}</span>}
      </div>
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
      {!error && help && (
        <span id={helpId} className="field-help">
          {help}
        </span>
      )}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly (string | SelectOption)[];
  help?: string;
  error?: string;
  containerClassName?: string;
}

export function SelectField({
  label,
  options,
  help,
  error,
  id: explicitId,
  containerClassName = '',
  className = '',
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = explicitId || generatedId;
  const errorId = error ? `${selectId}-error` : undefined;
  const helpId = help ? `${selectId}-help` : undefined;

  return (
    <div className={`field-group ${containerClassName} ${error ? 'has-error' : ''}`}>
      <label htmlFor={selectId} className="field-label">
        <span className="field-label-text">{label}</span>
      </label>
      <div className="field-input-wrapper">
        <select
          id={selectId}
          className={`field-select ${className}`}
          aria-invalid={Boolean(error)}
          aria-describedby={[errorId, helpId].filter(Boolean).join(' ') || undefined}
          {...props}
        >
          {options.map((opt) => {
            const val = typeof opt === 'string' ? opt : opt.value;
            const text = typeof opt === 'string' ? opt : opt.label;
            return (
              <option key={val} value={val}>
                {text}
              </option>
            );
          })}
        </select>
      </div>
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
      {!error && help && (
        <span id={helpId} className="field-help">
          {help}
        </span>
      )}
    </div>
  );
}
