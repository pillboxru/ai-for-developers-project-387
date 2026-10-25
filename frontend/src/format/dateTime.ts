// Гость видит время по поясу браузера. Дни и часы считаются через Intl
// с явным поясом: локальные методы Date зависят от пояса процесса

export function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Дата момента в поясе как 'YYYY-MM-DD' — в таком виде даты принимает
// DatePicker. Локаль en-CA выбрана ради порядка год-месяц-день
export function dateKeyIn(instant: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant))
}

// Час по часам пояса, 0–23
export function hourIn(instant: string, timeZone: string) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(instant)),
  )
}

// Дата 'YYYY-MM-DD' и минуты от начала суток по часам пояса: так владелец
// задаёт расписание
export function wallTimeIn(instant: string, timeZone: string) {
  const [hours, minutes] = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(instant))
    .split(':')
    .map(Number)
  return { date: dateKeyIn(instant, timeZone), minutes: hours * 60 + minutes }
}

// «09:00»: 24 часа в любой локали браузера
export function formatTime(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(instant))
}

// Дата 'YYYY-MM-DD' как момент в полдень UTC. Читать её только UTC-методами
// Date или Intl с поясом UTC: тогда дата не сдвигается ни в каком поясе
// процесса, а прибавление суток не задевает переходов на летнее время
export function noonUtcOf(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`)
}

// «пт, 24 октября» для даты 'YYYY-MM-DD'
export function formatDateKey(dateKey: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(noonUtcOf(dateKey))
}

// «пт, 24 октября, 10:00–10:30» по часам пояса: время выбранного слота
// и забронированного звонка
export function formatSlotTime(
  slot: { start: string; end: string },
  timeZone: string,
) {
  const date = formatDateKey(dateKeyIn(slot.start, timeZone))
  return `${date}, ${formatTime(slot.start, timeZone)}–${formatTime(slot.end, timeZone)}`
}
