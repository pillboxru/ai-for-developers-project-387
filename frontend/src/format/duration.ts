// «15 мин», «1 ч», «1 ч 30 мин»: так длительность и шаг подписаны везде
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours > 0 && `${hours} ч`, rest > 0 && `${rest} мин`]
    .filter(Boolean)
    .join(' ')
}
