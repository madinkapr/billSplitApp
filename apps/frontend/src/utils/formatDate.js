const SHORT_MONTHS = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek'],
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

// Intl.DateTimeFormat's CLDR data for 'uz' is incomplete in some browsers/runtimes and
// falls back to raw skeleton tokens like "M08" instead of a month name — so short dates
// are formatted from our own fixed month lists instead of relying on toLocaleDateString.
export function formatShortDate(createdAt, language) {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  const months = SHORT_MONTHS[language] || SHORT_MONTHS.en
  return `${date.getDate()} ${months[date.getMonth()]}`
}
