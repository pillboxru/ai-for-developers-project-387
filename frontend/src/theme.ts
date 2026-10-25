import { createTheme } from '@mantine/core'

const fontFamily = "'Inter Variable', system-ui, -apple-system, sans-serif"

export const theme = createTheme({
  primaryColor: 'indigo',
  defaultRadius: 'md',
  fontFamily,
  headings: { fontFamily },
})
