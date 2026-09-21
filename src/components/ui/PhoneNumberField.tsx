import { useState } from 'react'
import type { CountryCode } from 'libphonenumber-js'
import { formatPhoneInput, phoneCountries, phoneCountry, phoneCountryLabel, phoneNationalNumber } from '../../lib/phone'

export function PhoneNumberField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [country, setCountry] = useState(() => phoneCountry(value))
  const [nationalNumber, setNationalNumber] = useState(() => phoneNationalNumber(value))

  function updateNumber(nextValue: string, nextCountry = country) {
    const formatted = formatPhoneInput(nextValue, nextCountry)
    setCountry(formatted.country)
    setNationalNumber(formatted.formatted)
    onChange(formatted.value)
  }

  function changeCountry(nextCountry: CountryCode) {
    setCountry(nextCountry)
    updateNumber(nationalNumber, nextCountry)
  }

  return <span className="phone-number-field">
    <select aria-label="País" onChange={(event) => changeCountry(event.target.value as CountryCode)} value={country}>
      {phoneCountries.map((option) => <option key={option} value={option}>{phoneCountryLabel(option)}</option>)}
    </select>
    <input
      autoComplete="tel-national"
      id={id}
      inputMode="tel"
      name="phone"
      onChange={(event) => updateNumber(event.target.value)}
      placeholder="600 000 000"
      type="tel"
      value={nationalNumber}
    />
  </span>
}
