import { useId, useState } from 'react';
import { Button } from './Button';

export interface ChartDataPoint {
  label: string;
  value: number;
  formattedValue?: string;
  target?: number;
  date?: string;
  sublabel?: string;
}

export interface ChartSummaryProps {
  title: string;
  description?: string;
  unit: string;
  data: ChartDataPoint[];
  targetValue?: number;
  showTableToggle?: boolean;
  className?: string;
}

export function ChartSummary({
  title,
  description,
  unit,
  data,
  targetValue,
  showTableToggle = true,
  className = '',
}: ChartSummaryProps) {
  const chartId = useId();
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) {
    return (
      <div className={`chart-summary empty ${className}`}>
        <h4 className="chart-title">{title}</h4>
        <p className="chart-empty-msg">No historical data available to graph.</p>
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = Math.max(1, maxVal - minVal);
  const average = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  const firstVal = values[0] ?? 0;
  const lastVal = values[values.length - 1] ?? 0;
  const netDelta = (lastVal - firstVal).toFixed(1);

  const summaryText = `${title}: ${data.length} records. Ranging from ${minVal} ${unit} to ${maxVal} ${unit}. Average: ${average} ${unit}. Net change: ${Number(netDelta) > 0 ? '+' : ''}${netDelta} ${unit}.`;

  return (
    <figure className={`chart-summary ${className}`} aria-labelledby={`${chartId}-title`}>
      <div className="chart-header">
        <div className="chart-title-area">
          <h4 id={`${chartId}-title`} className="chart-title">
            {title}
          </h4>
          {description && <p className="chart-desc">{description}</p>}
        </div>
        {showTableToggle && (
          <Button
            size="small"
            variant="quiet"
            onClick={() => setShowTable((prev) => !prev)}
            aria-expanded={showTable}
            aria-controls={`${chartId}-table`}
          >
            {showTable ? 'Hide Table' : 'View Data Table'}
          </Button>
        )}
      </div>

      {/* Screen Reader Summary */}
      <div className="sr-only" aria-live="polite">
        {summaryText}
      </div>

      {/* Visual Bar Chart */}
      <div className="chart-visual" aria-hidden="true">
        <div className="chart-bars-container">
          {data.map((point) => {
            // Normalized height between 20% and 100%
            const pct = Math.round(20 + ((point.value - minVal) / range) * 80);
            return (
              <div
                key={`${point.date ?? point.label}-${point.value}`}
                className="chart-bar-col"
                title={`${point.label}: ${point.formattedValue ?? point.value} ${unit}`}
              >
                <span className="chart-bar-val tabular-nums">
                  {point.formattedValue ?? point.value}
                </span>
                <div className="chart-bar-track">
                  <div className="chart-bar-fill" style={{ height: `${pct}%` }} />
                </div>
                <span className="chart-bar-lbl">{point.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Metric Highlights */}
      <div className="chart-stats-row">
        <div className="chart-stat">
          <span className="chart-stat-lbl">Average</span>
          <span className="chart-stat-val tabular-nums">
            {average} {unit}
          </span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-lbl">Range</span>
          <span className="chart-stat-val tabular-nums">
            {minVal} – {maxVal} {unit}
          </span>
        </div>
        <div className="chart-stat">
          <span className="chart-stat-lbl">Net Delta</span>
          <span
            className={`chart-stat-val tabular-nums ${Number(netDelta) < 0 ? 'text-trend-down' : 'text-trend-up'}`}
          >
            {Number(netDelta) > 0 ? '+' : ''}
            {netDelta} {unit}
          </span>
        </div>
        {targetValue !== undefined && (
          <div className="chart-stat">
            <span className="chart-stat-lbl">Target</span>
            <span className="chart-stat-val tabular-nums">
              {targetValue} {unit}
            </span>
          </div>
        )}
      </div>

      {/* Accessible Table (visible when toggled, or accessible via DOM) */}
      {showTable && (
        <div id={`${chartId}-table`} className="chart-table-wrap">
          <table className="chart-data-table">
            <caption className="sr-only">{title} data table</caption>
            <thead>
              <tr>
                <th scope="col">Date / Label</th>
                <th scope="col">Recorded Value ({unit})</th>
                {targetValue !== undefined && <th scope="col">Target ({unit})</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={`${d.date ?? d.label}-${d.value}`}>
                  <td>{d.date ?? d.label}</td>
                  <td className="tabular-nums">{d.formattedValue ?? d.value}</td>
                  {targetValue !== undefined && <td className="tabular-nums">{targetValue}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
