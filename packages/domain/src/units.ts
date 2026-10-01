export function weightInKg(value: number, unit: 'kg' | 'lb'): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error('Invalid weight: must be a positive finite number');
  const kg = unit === 'lb' ? value * 0.45359237 : value;
  if (kg < 20 || kg > 500)
    throw new Error(`Weight ${kg.toFixed(1)} kg outside supported range (20–500 kg)`);
  return Math.round(kg * 1_000_000) / 1_000_000;
}

export function weightInLb(valueKg: number): number {
  if (!Number.isFinite(valueKg) || valueKg <= 0)
    throw new Error('Invalid weight: must be a positive finite number');
  const lb = valueKg / 0.45359237;
  return Math.round(lb * 10) / 10;
}

export function heightInCm(value: number, unit: 'cm' | 'in'): number {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error('Invalid height: must be a positive finite number');
  const cm = unit === 'in' ? value * 2.54 : value;
  if (cm < 50 || cm > 250)
    throw new Error(`Height ${cm.toFixed(1)} cm outside supported range (50–250 cm)`);
  return Math.round(cm * 10) / 10;
}

export function heightInInches(valueCm: number): number {
  if (!Number.isFinite(valueCm) || valueCm <= 0)
    throw new Error('Invalid height: must be a positive finite number');
  const inches = valueCm / 2.54;
  return Math.round(inches * 10) / 10;
}

export function energyInKcal(value: number, unit: 'kcal' | 'kj'): number {
  if (!Number.isFinite(value) || value < 0)
    throw new Error('Invalid energy: must be a non-negative finite number');
  const kcal = unit === 'kj' ? value / 4.184 : value;
  return Math.round(kcal);
}

export function energyInKj(valueKcal: number): number {
  if (!Number.isFinite(valueKcal) || valueKcal < 0)
    throw new Error('Invalid energy: must be a non-negative finite number');
  return Math.round(valueKcal * 4.184);
}
