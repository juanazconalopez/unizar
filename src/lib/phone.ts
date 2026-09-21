import { AsYouType, getCountries, getCountryCallingCode, isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js'
import type { CountryCode } from 'libphonenumber-js'

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'ES'

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' })

export const phoneCountries = getCountries().sort((first, second) => (
  regionNames.of(first)!.localeCompare(regionNames.of(second)!, 'es')
))

export function phoneCountry(value: string | null | undefined): CountryCode {
  return parsePhoneNumberFromString(value ?? '')?.country ?? DEFAULT_PHONE_COUNTRY
}

export function phoneNationalNumber(value: string | null | undefined): string {
  return parsePhoneNumberFromString(value ?? '')?.formatNational() ?? ''
}

export function formatPhoneInput(value: string, country: CountryCode) {
  const formatter = new AsYouType(country)
  const formatted = formatter.input(value)
  return {
    country: formatter.getCountry() ?? country,
    formatted,
    value: formatter.getNumberValue() ?? '',
  }
}

export function isValidInternationalPhone(value: string) {
  return !value || isValidPhoneNumber(value)
}

export function formatPhoneForExport(value: string | null | undefined) {
  const phone = parsePhoneNumberFromString(value ?? '')
  if (!phone) return value ?? ''
  return phone.country === 'ES' ? phone.formatNational() : phone.formatInternational()
}

export function phoneCountryLabel(country: CountryCode) {
  return `${regionNames.of(country) ?? country} (+${getCountryCallingCode(country)})`
}
