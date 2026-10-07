export interface MetricProps {
  value: string | number;
  label: string;
  unit?: string;
  subtext?: string;
  className?: string;
}

export function Metric({ value, label, unit, subtext, className = '' }: MetricProps) {
  return (
    <div className={`metric-box ${className}`}>
      <div className="metric-value-row">
        <span className="metric-number tabular-nums">{value}</span>
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
      <p className="metric-label">{label}</p>
      {subtext && <p className="metric-subtext">{subtext}</p>}
    </div>
  );
}
