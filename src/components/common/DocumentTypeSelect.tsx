import React, { useState, useEffect } from 'react';
import {
  PREDEFINED_DOCUMENT_TYPE_GROUPS,
  PREDEFINED_DOCUMENT_TYPES,
} from '../../config/constants';

interface DocumentTypeSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const CUSTOM_VALUE = '__CUSTOM__';

/**
 * Shared Document Type dropdown with grouped Identity, Education, Work, and Financial proofs,
 * plus an "Other (Custom)" option that reveals a free-text input.
 */
export const DocumentTypeSelect: React.FC<DocumentTypeSelectProps> = ({
  id,
  value,
  onChange,
  className = '',
  style,
}) => {
  const isPredefined = PREDEFINED_DOCUMENT_TYPES.includes(value);
  const [customMode, setCustomMode] = useState<boolean>(() => Boolean(value && !isPredefined));

  useEffect(() => {
    if (value && PREDEFINED_DOCUMENT_TYPES.includes(value)) {
      setCustomMode(false);
    }
  }, [value]);

  const selectValue = customMode || (!isPredefined && value !== '') ? CUSTOM_VALUE : value || 'Passport / ID';

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === CUSTOM_VALUE) {
      setCustomMode(true);
      onChange('');
    } else {
      setCustomMode(false);
      onChange(next);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <select
        id={id}
        value={selectValue}
        onChange={handleSelectChange}
        className={
          className ||
          'h-9 w-full sm:w-64 px-3 text-[13px] text-slate-900 border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none bg-white cursor-pointer'
        }
        style={style}
      >
        {PREDEFINED_DOCUMENT_TYPE_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={CUSTOM_VALUE}>Other (Custom Document Name)...</option>
      </select>

      {customMode && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom document name"
          autoFocus
          className={
            className ||
            'h-9 w-full sm:w-52 px-3 text-[13px] text-slate-900 border border-slate-200 rounded-md focus:border-blue-500 focus:outline-none bg-white'
          }
          style={style}
        />
      )}
    </div>
  );
};

export default DocumentTypeSelect;
