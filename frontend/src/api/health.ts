import { getHealth } from './generated/sdk.gen.ts'
import type { Health } from './generated/types.gen.ts'

export async function fetchHealth(): Promise<Health> {
  const { data } = await getHealth()
  return data
}
