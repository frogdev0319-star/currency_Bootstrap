import dayjs from 'dayjs'

// Generic pair fetcher using fawazahmed0 currency API (free, CORS-enabled)
// base: e.g., 'TWD'; quote: e.g., 'JPY'
// Returns [{ date: 'YYYY-MM-DD', value: number }]
export async function getPairRates(base, quote, startDate, endDate) {
  const start = dayjs(startDate)
  const end = dayjs(endDate)
  const baseLower = base.toLowerCase()
  const quoteLower = quote.toLowerCase()

  try {
    const results = []
    const today = dayjs().startOf('day')

    // Iterate through each day in the range
    let currentDate = start
    while (currentDate.isBefore(end) || currentDate.isSame(end, 'day')) {
      const dateStr = currentDate.format('YYYY-MM-DD')

      // Use latest endpoint for today, historical for past dates
      const isToday = currentDate.isSame(today, 'day')
      const endpoint = isToday ? 'latest' : dateStr
      const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${endpoint}/v1/currencies/${baseLower}.json`

      try {
        const res = await fetch(url)
        if (!res.ok) {
          console.warn(`Failed to fetch ${dateStr}: HTTP ${res.status}`)
          currentDate = currentDate.add(1, 'day')
          continue
        }

        const json = await res.json()
        const rates = json[baseLower]

        if (rates && rates[quoteLower]) {
          results.push({
            date: dateStr,
            value: Number(Number(rates[quoteLower]).toFixed(6))
          })
        }
      } catch (err) {
        console.warn(`Error fetching ${dateStr}:`, err)
      }

      currentDate = currentDate.add(1, 'day')

      // Add small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    if (results.length === 0) {
      throw new Error('無法取得匯率資料')
    }

    return results.sort((a, b) => a.date.localeCompare(b.date))

  } catch (error) {
    console.error('API Error:', error)
    throw new Error('無法取得匯率資料，請稍後再試')
  }
}

// Backward compatible helper for default view (TWD/JPY)
export async function getYenRates(startDate, endDate) {
  return getPairRates('TWD', 'JPY', startDate, endDate)
}
