import { getOwnerOptions } from './generated/@tanstack/react-query.gen.ts'

// Профиль владельца из конфигурации: имя и IANA-пояс
export const ownerQuery = () => getOwnerOptions()
