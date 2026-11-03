import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { COUNTRIES, cleanDial, countryForDial, splitInternational } from '../lib/phone';
import { cx } from './ui';

const OTHER = '__other__';

/**
 * Country code + number in one box. The code defaults to +256 and can be
 * changed from the list, or typed by hand for any country not listed.
 */
export function PhoneInput({
  id,
  dial,
  onDialChange,
  value,
  onChange,
  disabled,
  autoFocus,
  placeholder,
  only,
}: {
  id: string;
  dial: string;
  onDialChange: (dial: string) => void;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** Restrict the list to these dial codes (and hide "Other"). */
  only?: string[];
}) {
  const options = only ? COUNTRIES.filter((c) => only.includes(c.dial)) : COUNTRIES;
  const known = countryForDial(dial);
  const [custom, setCustom] = useState(!known && !only);

  const pickFromList = (next: string) => {
    if (next === OTHER) {
      setCustom(true);
      onDialChange('');
      return;
    }
    setCustom(false);
    onDialChange(next);
  };

  const typeNumber = (text: string) => {
    // "+254 712 345 678" pasted into the number box: move the code across.
    const intl = splitInternational(text);
    if (intl && (!only || only.includes(intl.dial))) {
      setCustom(false);
      onDialChange(intl.dial);
      onChange(intl.rest);
      return;
    }
    onChange(text);
  };

  return (
    <div className={cx('phone-field', disabled && 'opacity-50')}>
      {custom ? (
        <label className="flex items-center pl-3 pr-1 shrink-0 text-ink-soft tnum text-[15px]">
          <span aria-hidden>+</span>
          <input
            aria-label="Country code"
            inputMode="numeric"
            autoComplete="tel-country-code"
            placeholder="code"
            disabled={disabled}
            autoFocus={custom && !dial}
            className="w-[3.4rem] bg-transparent outline-none py-3 tnum text-ink placeholder:text-ink-faint"
            value={dial}
            onChange={(e) => onDialChange(cleanDial(e.target.value))}
          />
          <button
            type="button"
            onClick={() => pickFromList(countryForDial(dial) ? dial : '256')}
            className="text-[11px] font-semibold text-accent px-1 cursor-pointer"
          >
            List
          </button>
        </label>
      ) : (
        <div className="relative flex items-center gap-1.5 pl-3 pr-2 shrink-0 text-[15px]">
          <span aria-hidden className="text-[18px] leading-none">{known?.flag ?? '🌍'}</span>
          <span className="tnum text-ink">+{dial}</span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-faint" aria-hidden />
          <select
            aria-label="Country"
            disabled={disabled}
            className="absolute inset-0 opacity-0 cursor-pointer"
            value={known ? dial : OTHER}
            onChange={(e) => pickFromList(e.target.value)}
          >
            {options.map((c) => (
              <option key={c.iso} value={c.dial}>
                {c.flag} {c.name} (+{c.dial})
              </option>
            ))}
            {!only && <option value={OTHER}>🌍 Other country — type code</option>}
          </select>
        </div>
      )}

      <span className="w-px self-stretch my-2.5 bg-line" aria-hidden />

      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder ?? (dial === '254' ? '712 345 678' : dial === '256' ? '770 123 456' : 'Phone number')}
        className="flex-1 min-w-0 bg-transparent outline-none px-3 py-3 tnum text-[15px] text-ink placeholder:text-ink-faint"
        value={value}
        onChange={(e) => typeNumber(e.target.value)}
      />
    </div>
  );
}
