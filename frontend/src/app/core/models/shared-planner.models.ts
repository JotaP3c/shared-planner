export type UserRole = 'ADMIN' | 'FINANCE' | 'USER';

export type CalendarMemberRole =
  | 'ADMIN'
  | 'FINANCE'
  | 'EDITOR'
  | 'VIEWER';

export type EventType = 'CLIENT' | 'PERSONAL' | 'SHARED';

export type EventStatus =
  | 'SCHEDULED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'REFUNDED';

export type PaymentMethod =
  | 'CASH'
  | 'PIX'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'BANK_TRANSFER'
  | 'MERCADO_PAGO'
  | 'OTHER';

export type RevenuePeriod = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export type AuditEntityType = 'USER' | 'CALENDAR' | 'CALENDAR_MEMBER' | 'EVENT';

export type AuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PAYMENT_UPDATED'
  | 'MEMBER_ADDED'
  | 'MEMBER_ROLE_UPDATED'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_UNSCHEDULED'
  | 'APPOINTMENT_RESCHEDULED';

export interface CalendarResponse {
  id: string;
  name: string;
  ownerEmail: string;
  memberRole: CalendarMemberRole | null;
  canCreateEvents: boolean;
  calendarType?: 'LEGACY' | 'PERSONAL' | 'SHARED' | 'IMPORTED';
  memberRoles?: CalendarMemberRole[];
}

export interface CreateCalendarRequest {
  name: string;
  calendarType?: 'SHARED' | 'IMPORTED';
}

export interface AddCalendarMemberRequest {
  email: string;
  role: CalendarMemberRole;
  roles?: CalendarMemberRole[];
}

export interface CalendarMemberResponse {
  id: string; calendarId: string; userEmail: string; userFullName: string;
  role: CalendarMemberRole; createdAt: string;
  roles?: CalendarMemberRole[];
}

export interface UpdateCalendarMemberRequest { role: CalendarMemberRole; roles?: CalendarMemberRole[]; }

export interface EventResponse {
  externalSource?: 'GOOGLE_ICS' | null;
  id: string;
  calendarId: string;
  createdByEmail: string;
  approvalRequestedFromEmail: string | null;
  approvedByEmail: string | null;
  eventType: EventType;
  status: EventStatus;
  title: string;
  clientName: string | null;
  personName: string | null;
  description: string | null;
  workDescription: string | null;
  clientPhone?: string | null;
  allDay?: boolean;
  approvalRequestedFromEmails?: string[];
  approvals?: EventApproval[];
  amount?: number | null;
  paymentStatus?: PaymentStatus | null;
  paymentMethod?: PaymentMethod | null;
  receivedAmount?: number | null;
  paidAt?: string | null;
  startsAt: string;
  endsAt: string;
  /** Somente CLIENT. Confirmação do cliente ≠ pagamento ≠ status do evento. */
  confirmationStatus?: AppointmentConfirmationStatus | null;
  confirmationChangedAt?: string | null;
  confirmationChangedByEmail?: string | null;
  rescheduleCount?: number | null;
  unscheduleReason?: UnscheduleReason | null;
  unscheduleNotes?: string | null;
}

export type AppointmentConfirmationStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'RESCHEDULED';

export type UnscheduleReason = 'RESCHEDULE' | 'GAVE_UP' | 'OTHER';

export interface UnscheduleAppointmentRequest {
  reason: UnscheduleReason;
  notes?: string | null;
  newStartsAt?: string | null;
  newEndsAt?: string | null;
}

export interface ConfirmationHistoryResponse {
  id: string;
  eventId: string;
  previousStatus: AppointmentConfirmationStatus | null;
  newStatus: AppointmentConfirmationStatus;
  reason: UnscheduleReason | null;
  notes: string | null;
  previousStartsAt: string | null;
  previousEndsAt: string | null;
  newStartsAt: string | null;
  newEndsAt: string | null;
  performedByEmail: string;
  performedAt: string;
}

export interface EventSearchResponse {
  externalSource?: 'GOOGLE_ICS' | null;
  id: string;
  calendarId: string;
  calendarName: string;
  createdByEmail: string;
  approvalRequestedFromEmail: string | null;
  eventType: EventType;
  status: EventStatus;
  title: string;
  clientName: string | null;
  personName: string | null;
  startsAt: string;
  endsAt: string;
}

export interface CreateEventRequest {
  calendarId: string;
  eventType: EventType;
  title: string;
  clientName?: string | null;
  personName?: string | null;
  description?: string | null;
  workDescription?: string | null;
  clientPhone?: string | null;
  allDay?: boolean;
  amount?: number | null;
  startsAt: string;
  endsAt: string;
  approvalRequestedFromEmail?: string | null;
  approvalRequestedFromEmails?: string[];
}

export interface EventApproval {
  userEmail: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  round: number;
  requestedAt: string;
  respondedAt: string | null;
}

export interface RecurrenceRequest {
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM';
  interval?: number;
  weekDays?: string[];
  until?: string;
  count?: number;
  zoneId: string;
}

export interface EventSeriesResponse {
  id: string;
  frequency: RecurrenceRequest['frequency'];
  zoneId: string;
  events: EventResponse[];
  conflictCount?: number | null;
}

export type UpdateEventRequest = Omit<CreateEventRequest, 'calendarId'>;

export interface UpdatePaymentRequest {
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | null;
  receivedAmount?: number | null;
  paidAt?: string | null;
}

export interface FinanceSummaryResponse {
  calendarId: string;
  startDate: string;
  endDate: string;
  expectedAmount: number;
  receivedAmount: number;
  pendingAmount: number;
  appointmentCount: number;
  paidCount: number;
  pendingCount: number;
  partiallyPaidCount: number;
  refundedCount: number;
  /** Indicadores de confirmação (contagens mutuamente exclusivas sobre appointmentCount). */
  confirmedAmount: number;
  unconfirmedAmount: number;
  unscheduledAmount: number;
  confirmedCount: number;
  awaitingConfirmationCount: number;
  rescheduledCount: number;
  unscheduledCount: number;
  rescheduleOccurrences: number;
}

export interface FinanceTimelinePoint {
  date: string;
  expectedAmount: number;
  receivedAmount: number;
  appointmentCount: number;
}

export interface FinanceTimelineResponse {
  calendarId: string;
  startDate: string;
  endDate: string;
  granularity: 'DAY' | 'MONTH';
  points: FinanceTimelinePoint[];
}

export interface FinanceAppointmentResponse {
  eventId: string;
  calendarId: string;
  startsAt: string;
  clientName: string | null;
  workDescription: string | null;
  amount: number;
  receivedAmount: number;
  paymentStatus: PaymentStatus;
  confirmationStatus: AppointmentConfirmationStatus | null;
}

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  fullName: string;
  role: UserRole;
  active: boolean;
}

export interface AuditLogResponse {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  calendarId: string | null;
  action: AuditAction;
  summary: string;
  oldValue: string | null;
  newValue: string | null;
  performedByEmail: string;
  performedAt: string;
}

export interface ClientRevenueSummaryResponse {
  calendarId: string;
  period: RevenuePeriod;
  referenceDate: string;
  periodStart: string;
  periodEndExclusive: string;
  totalAmount: number;
  appointmentCount: number;
}
