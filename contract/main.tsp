import "@typespec/http";
import "@typespec/openapi";

using Http;
using OpenAPI;

/** API сервиса записи на звонок. Термины — в GLOSSARY.md. */
@service(#{ title: "Календарь звонков" })
@route("/api")
namespace CallCalendar;

// Строки проверяет только схема, сервис их не обрезает: фронтенд обрезает
// пробелы сам и не отправляет пустые необязательные поля.

@format("uuid")
scalar Uuid extends string;

/** Однострочный текст без пробелов по краям. */
@pattern("^\\S(.*\\S)?$")
scalar SingleLine extends string;

/** Многострочный текст, в котором есть хотя бы один непробельный символ. */
@pattern("\\S")
scalar MultiLine extends string;

/** Время суток по часам владельца, кратно 30 минутам; конец дня — 24:00. */
@pattern("^(([01]\\d|2[0-3]):[03]0|24:00)$")
scalar TimeOfDay extends string;

/** Минуты, кратные 15, от 15 до 240. */
enum Minutes15 {
  m15: 15,
  m30: 30,
  m45: 45,
  m60: 60,
  m75: 75,
  m90: 90,
  m105: 105,
  m120: 120,
  m135: 135,
  m150: 150,
  m165: 165,
  m180: 180,
  m195: 195,
  m210: 210,
  m225: 225,
  m240: 240,
}

// ---------- Модели ----------

model Health {
  status: "ok";
}

/** Профиль владельца задан конфигурацией. */
model Owner {
  name: string;

  /** IANA-имя часового пояса владельца. */
  timeZone: string;
}

/** 14 дней с 00:00 сегодняшней даты владельца, моменты в UTC. */
model BookingWindow {
  start: utcDateTime;
  end: utcDateTime;
}

model Slot {
  start: utcDateTime;
  end: utcDateTime;
}

model SlotList {
  bookingWindow: BookingWindow;
  slots: Slot[];
}

model EventType {
  @visibility(Lifecycle.Read)
  id: Uuid;

  @minLength(1)
  @maxLength(100)
  title: SingleLine;

  @maxLength(1000)
  description?: MultiLine;

  durationMinutes: Minutes15;
  slotStepMinutes: Minutes15;

  /** Скрытый тип события: гость его не видит. */
  hidden: boolean;

  /** Есть ли неотменённые бронирования, в том числе прошедшие (ADR 0002). */
  @visibility(Lifecycle.Read)
  hasBookings: boolean;
}

/** Тип события, каким его видит гость. */
model PublicEventType {
  ...PickProperties<
    EventType,
    "id" | "title" | "description" | "durationMinutes"
  >;
}

model BookingEventType {
  id: Uuid;
  title: string;
  hidden: boolean;
}

model Booking {
  @visibility(Lifecycle.Read)
  id: Uuid;

  @visibility(Lifecycle.Read)
  eventType: BookingEventType;

  /** Начало одного из слотов типа события. */
  start: utcDateTime;

  /** Начало плюс длительность типа события (ADR 0002). */
  @visibility(Lifecycle.Read)
  end: utcDateTime;

  @minLength(1)
  @maxLength(100)
  name: SingleLine;

  @maxLength(254)
  @pattern("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
  email: string;

  @maxLength(1000)
  comment?: MultiLine;

  @visibility(Lifecycle.Read)
  cancelled: boolean;
}

/** Промежуток одного дня. start < end проверяет сервер. */
model TimeRange {
  start: TimeOfDay;
  end: TimeOfDay;
}

/** Промежутки каждого дня идут по возрастанию, не пересекаются и не соприкасаются. */
model WeeklySchedule {
  monday: TimeRange[];
  tuesday: TimeRange[];
  wednesday: TimeRange[];
  thursday: TimeRange[];
  friday: TimeRange[];
  saturday: TimeRange[];
  sunday: TimeRange[];
}

/** Исключение: заменяет расписание на дату. Пустой ranges — дата закрыта. */
model DateOverride {
  date: plainDate;
  ranges: TimeRange[];
}

model Schedule {
  weekly: WeeklySchedule;

  /** Все исключения по возрастанию даты. При сохранении прошедшие даты игнорируются. */
  overrides: DateOverride[];

  @visibility(Lifecycle.Read)
  bookingWindow: BookingWindow;
}

// ---------- Ошибки ----------

union ErrorCode {
  "validation_error",
  "not_found",
  "slot_unavailable",
  "event_type_title_taken",
  "event_type_has_bookings",
  "schedule_conflicts_with_bookings",
  "booking_ended",
  "internal_error",
}

model FieldError {
  /** Путь через точки от корня тела: title, overrides.2.ranges.0.end. */
  field: string;

  message: string;
}

/** Одна модель для всех ошибок. */
model ApiError {
  code: ErrorCode;
  message: string;

  /** Только у ошибок тела запроса. */
  fieldErrors?: FieldError[];

  /** Бронирования, которые мешают сохранить расписание. */
  bookings?: Booking[];
}

@error
model BadRequest {
  @statusCode statusCode: 400;
  @body body: ApiError;
}

@error
model NotFound {
  @statusCode statusCode: 404;
  @body body: ApiError;
}

@error
model Conflict {
  @statusCode statusCode: 409;
  @body body: ApiError;
}

model Created<T> {
  @statusCode statusCode: 201;
  @body body: T;
}

// ---------- Общие операции ----------

@tag("common")
@route("/health")
@get
@operationId("getHealth")
op getHealth(): Health;

@tag("common")
@route("/owner")
@get
@operationId("getOwner")
op getOwner(): Owner;

// ---------- Гость ----------

@tag("guest")
@route("/event-types")
namespace Guest {
  /** Видимые типы событий в порядке создания. */
  @get
  @operationId("listEventTypes")
  op listEventTypes(): PublicEventType[];

  /** Скрытый тип события для гостя не существует. */
  @route("/{eventTypeId}")
  @get
  @operationId("getEventType")
  op getEventType(@path eventTypeId: Uuid):
    | PublicEventType
    | BadRequest
    | NotFound;

  /** Слоты на всё окно записи плоским списком. */
  @route("/{eventTypeId}/slots")
  @get
  @operationId("listSlots")
  op listSlots(@path eventTypeId: Uuid): SlotList | BadRequest | NotFound;

  /** Принимается, только если start — один из вычисленных слотов, иначе 409 slot_unavailable. */
  @route("/{eventTypeId}/bookings")
  @post
  @operationId("createBooking")
  op createBooking(@path eventTypeId: Uuid, @body body: Create<Booking>):
    | Created<Booking>
    | BadRequest
    | NotFound
    | Conflict;
}

// ---------- Владелец ----------

@tag("admin")
@route("/admin")
namespace Admin {
  /** Все типы событий, включая скрытые, в порядке создания. */
  @route("/event-types")
  @get
  @operationId("listAdminEventTypes")
  op listAdminEventTypes(): EventType[];

  @route("/event-types")
  @post
  @operationId("createEventType")
  op createEventType(@body body: Create<EventType>):
    | Created<EventType>
    | BadRequest
    | Conflict;

  /** Длительность меняется, только пока у типа нет неотменённых бронирований. */
  @route("/event-types/{eventTypeId}")
  @put
  @operationId("updateEventType")
  op updateEventType(@path eventTypeId: Uuid, @body body: Update<EventType>):
    | EventType
    | BadRequest
    | NotFound
    | Conflict;

  /** Только у типа без неотменённых бронирований; отменённые удаляются вместе с ним. */
  @route("/event-types/{eventTypeId}")
  @delete
  @operationId("deleteEventType")
  op deleteEventType(@path eventTypeId: Uuid):
    | NoContentResponse
    | BadRequest
    | NotFound
    | Conflict;

  /** Предстоящие бронирования, включая отменённые, по началу. */
  @route("/bookings")
  @get
  @operationId("listBookings")
  op listBookings(): Booking[];

  /** Повторная отмена возвращает уже отменённое бронирование. */
  @route("/bookings/{bookingId}/cancel")
  @post
  @operationId("cancelBooking")
  op cancelBooking(@path bookingId: Uuid):
    | Booking
    | BadRequest
    | NotFound
    | Conflict;

  @route("/schedule")
  @get
  @operationId("getSchedule")
  op getSchedule(): Schedule;

  /** Сохраняет расписание и исключения атомарно. */
  @route("/schedule")
  @put
  @operationId("updateSchedule")
  op updateSchedule(@body body: Update<Schedule>):
    | Schedule
    | BadRequest
    | Conflict;
}
