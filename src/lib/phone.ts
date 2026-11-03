/**
 * Phone numbers, country codes and the sign-in identity derived from them.
 *
 * Accounts are Firebase email/password users whose "email" is built from the
 * phone number. Uganda and Kenya keep the exact format existing accounts were
 * created with, so nobody who already signed up is locked out:
 *
 *   Uganda   +256 770 123 456  →  0770123456@investio.app
 *   Kenya    +254 712 345 678  →  254712345678@investio.app
 *   Others   +234 803 123 4567 →  2348031234567@investio.app
 */

export interface DialCountry {
  iso: string;
  name: string;
  dial: string;
  flag: string;
}

/** Shown in the picker. Anything else can be typed under "Other". */
export const COUNTRIES: DialCountry[] = [
  { iso: 'UG', name: 'Uganda', dial: '256', flag: '🇺🇬' },
  { iso: 'KE', name: 'Kenya', dial: '254', flag: '🇰🇪' },
  { iso: 'TZ', name: 'Tanzania', dial: '255', flag: '🇹🇿' },
  { iso: 'RW', name: 'Rwanda', dial: '250', flag: '🇷🇼' },
  { iso: 'BI', name: 'Burundi', dial: '257', flag: '🇧🇮' },
  { iso: 'SS', name: 'South Sudan', dial: '211', flag: '🇸🇸' },
  { iso: 'CD', name: 'DR Congo', dial: '243', flag: '🇨🇩' },
  { iso: 'ET', name: 'Ethiopia', dial: '251', flag: '🇪🇹' },
  { iso: 'NG', name: 'Nigeria', dial: '234', flag: '🇳🇬' },
  { iso: 'GH', name: 'Ghana', dial: '233', flag: '🇬🇭' },
  { iso: 'ZM', name: 'Zambia', dial: '260', flag: '🇿🇲' },
  { iso: 'ZW', name: 'Zimbabwe', dial: '263', flag: '🇿🇼' },
  { iso: 'MW', name: 'Malawi', dial: '265', flag: '🇲🇼' },
  { iso: 'ZA', name: 'South Africa', dial: '27', flag: '🇿🇦' },
  { iso: 'AE', name: 'UAE', dial: '971', flag: '🇦🇪' },
  { iso: 'GB', name: 'United Kingdom', dial: '44', flag: '🇬🇧' },
  { iso: 'US', name: 'United States / Canada', dial: '1', flag: '🇺🇸' },
  { iso: 'IN', name: 'India', dial: '91', flag: '🇮🇳' },
];

export const DEFAULT_DIAL = '256';

/** Mobile-money collection (Marz Pay) only reaches these two networks. */
export const PAYMENT_DIALS = ['256', '254'];

export function cleanDial(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

export function countryForDial(dial: string): DialCountry | undefined {
  return COUNTRIES.find((c) => c.dial === cleanDial(dial));
}

/** "+256 770 123 456" / "0770123456" / "770123456" → "770123456". */
export function nationalDigits(input: string, dial: string): string {
  let digits = input.replace(/\D/g, '');
  const code = cleanDial(dial);
  const typedInternational = input.trim().startsWith('+') || input.trim().startsWith('00');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (code && digits.startsWith(code) && (typedInternational || digits.length - code.length >= 8)) {
    digits = digits.slice(code.length);
  }
  return digits.replace(/^0+/, '');
}

/**
 * If someone pastes "+254 712…" into the number box, pick up the code from it.
 * Returns null when the text does not start with a known code.
 */
export function splitInternational(input: string): { dial: string; rest: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) return null;
  const digits = trimmed.replace(/\D/g, '').replace(/^00/, '');
  for (const len of [3, 2, 1]) {
    const dial = digits.slice(0, len);
    if (countryForDial(dial)) return { dial, rest: digits.slice(len) };
  }
  return null;
}

export interface ParsedPhone {
  ok: boolean;
  error?: string;
  dial: string;
  national: string;
  /** +256770123456 */
  international: string;
  /** What we store and show: 0770123456 for UG/KE, +2348031234567 otherwise. */
  display: string;
  /** Firebase Auth email used to sign in. */
  identity: string;
  /** ISO code, or 'INTL' for a code we do not list. */
  country: string;
}

export function parsePhone(dialInput: string, numberInput: string): ParsedPhone {
  const dial = cleanDial(dialInput);
  const national = nationalDigits(numberInput, dial);
  const international = `+${dial}${national}`;
  const country = countryForDial(dial)?.iso ?? 'INTL';
  const base = { dial, national, international, country };

  if (!dial) {
    return { ...base, ok: false, error: 'Enter your country code, e.g. +256.', display: '', identity: '' };
  }

  let error: string | undefined;
  if (dial === '256' && !/^(7|3)\d{8}$/.test(national)) {
    error = 'Enter a valid Uganda number, e.g. 0770 123 456.';
  } else if (dial === '254' && !/^(7|1)\d{8}$/.test(national)) {
    error = 'Enter a valid Kenya number, e.g. 0712 345 678.';
  } else if (!/^\d{6,13}$/.test(national) || dial.length + national.length > 15) {
    error = 'Enter a valid phone number.';
  }

  const display = dial === '256' || dial === '254' ? `0${national}` : international;
  const prefix = dial === '256' ? `0${national}` : `${dial}${national}`;

  return {
    ...base,
    ok: !error,
    error,
    display,
    identity: `${prefix}@investio.app`,
  };
}

/** Reverse of what we store, so a saved number can pre-fill a phone field. */
export function splitStoredPhone(
  phoneDigits?: string | null,
  country?: string | null
): { dial: string; number: string } {
  const value = (phoneDigits || '').trim();
  if (!value) {
    const dial = COUNTRIES.find((c) => c.iso === country)?.dial ?? DEFAULT_DIAL;
    return { dial, number: '' };
  }
  const intl = splitInternational(value);
  if (intl) return { dial: intl.dial, number: intl.rest };
  if (value.startsWith('+')) {
    // Unlisted code: we cannot know where it ends, keep the whole thing.
    return { dial: DEFAULT_DIAL, number: value };
  }
  const dial = country === 'KE' ? '254' : '256';
  return { dial, number: value.replace(/\D/g, '').replace(/^0+/, '') };
}

/** Works out the country a legacy or new identity belongs to. */
export function countryFromIdentity(email?: string | null): { country: string; phoneDigits: string } {
  const prefix = (email?.split('@')[0] || '').replace(/\D/g, '');
  if (prefix.startsWith('0')) return { country: 'UG', phoneDigits: prefix };
  if (prefix.startsWith('254') && prefix.length === 12) return { country: 'KE', phoneDigits: `0${prefix.slice(3)}` };
  if (prefix.startsWith('256') && prefix.length === 12) return { country: 'UG', phoneDigits: `0${prefix.slice(3)}` };
  const intl = splitInternational(`+${prefix}`);
  if (intl) {
    const iso = countryForDial(intl.dial)?.iso ?? 'INTL';
    return { country: iso, phoneDigits: `+${prefix}` };
  }
  return { country: 'INTL', phoneDigits: prefix ? `+${prefix}` : '' };
}

export function flagFor(country?: string | null): string {
  return COUNTRIES.find((c) => c.iso === country)?.flag ?? '🌍';
}

export function countryName(country?: string | null): string {
  return COUNTRIES.find((c) => c.iso === country)?.name ?? 'Other';
}
