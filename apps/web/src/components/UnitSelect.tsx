import { UNIT_OPTIONS, isCommonUnit } from '../lib/units';

interface UnitSelectProps {
  value: string;
  onChange: (unit: string) => void;
  id?: string;
  disabled?: boolean;
  /** Affiche une option « Autre… » si la valeur courante n’est pas dans la liste. */
  allowCustom?: boolean;
}

export function UnitSelect({
  value,
  onChange,
  id,
  disabled,
  allowCustom = true,
}: UnitSelectProps) {
  const known = isCommonUnit(value);
  const options = known
    ? UNIT_OPTIONS
    : allowCustom
      ? [...UNIT_OPTIONS, { value, label: value }]
      : UNIT_OPTIONS;

  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Unité"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
