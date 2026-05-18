import AsyncStorage from '@react-native-async-storage/async-storage'

const DATE_FORMAT_KEY = '@pref_date_format'
const CURRENCY_KEY = '@pref_currency'

export const DATE_FORMATS = [
  { value: 'long_fr', label: '18 mai 2026', example: '18 mai 2026' },
  { value: 'ddmmyyyy', label: '18/05/2026', example: '18/05/2026' },
  { value: 'yyyymmdd', label: '2026-05-18', example: '2026-05-18' },
  { value: 'short_fr', label: '18 mai', example: '18 mai' },
]

export const CURRENCIES = [
  { value: 'EUR', symbol: '€', label: 'Euro (€)' },
  { value: 'CHF', symbol: 'CHF', label: 'Franc suisse (CHF)' },
  { value: 'USD', symbol: '$', label: 'Dollar ($)' },
  { value: 'GBP', symbol: '£', label: 'Livre (£)' },
]

let cachedDateFormat = 'long_fr'
let cachedCurrency = 'EUR'

export const loadFormatPrefs = async () => {
  try {
    const [df, cur] = await Promise.all([
      AsyncStorage.getItem(DATE_FORMAT_KEY),
      AsyncStorage.getItem(CURRENCY_KEY),
    ])
    if (df) cachedDateFormat = df
    if (cur) cachedCurrency = cur
  } catch {}
  return { dateFormat: cachedDateFormat, currency: cachedCurrency }
}

export const setDateFormatPref = async (value) => {
  cachedDateFormat = value
  try { await AsyncStorage.setItem(DATE_FORMAT_KEY, value) } catch {}
}

export const setCurrencyPref = async (value) => {
  cachedCurrency = value
  try { await AsyncStorage.setItem(CURRENCY_KEY, value) } catch {}
}

export const getDateFormat = () => cachedDateFormat
export const getCurrency = () => cachedCurrency

const toDate = (d) => {
  if (!d) return null
  if (d instanceof Date) return d
  if (typeof d === 'string') {
    // Treat YYYY-MM-DD as local date to avoid UTC shift
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
    return new Date(d)
  }
  return new Date(d)
}

export const formatDate = (input, override) => {
  const date = toDate(input)
  if (!date || isNaN(date.getTime())) return ''
  const fmt = override || cachedDateFormat
  const day = date.getDate()
  const monthIdx = date.getMonth()
  const year = date.getFullYear()
  const monthsFr = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
  const dd = String(day).padStart(2, '0')
  const mm = String(monthIdx + 1).padStart(2, '0')
  switch (fmt) {
    case 'ddmmyyyy': return `${dd}/${mm}/${year}`
    case 'yyyymmdd': return `${year}-${mm}-${dd}`
    case 'short_fr': return `${day} ${monthsFr[monthIdx]}`
    case 'long_fr':
    default: return `${day} ${monthsFr[monthIdx]} ${year}`
  }
}

export const formatCurrency = (amount, override) => {
  if (amount === null || amount === undefined || amount === '') return ''
  const cur = override || cachedCurrency
  const meta = CURRENCIES.find(c => c.value === cur) || CURRENCIES[0]
  const n = typeof amount === 'number' ? amount : parseFloat(amount)
  if (isNaN(n)) return ''
  const rounded = Math.round(n * 100) / 100
  const str = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2)
  return meta.value === 'CHF' ? `${str} ${meta.symbol}` : `${str}${meta.symbol}`
}
