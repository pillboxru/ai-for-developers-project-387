// Что гость ввёл в форму. Живёт выше формы: при возврате к выбору слота
// форма размонтируется, а данные подставляются в неё снова (14.2)
export interface GuestDetails {
  name: string
  email: string
  comment: string
}

export const emptyGuestDetails: GuestDetails = {
  name: '',
  email: '',
  comment: '',
}
