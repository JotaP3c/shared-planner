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
  | 'MEMBER_ROLE_UPDATED';

export interface CalendarResponse {
  id: string;
  name: string;
  ownerEmail: string;
  memberRole: CalendarMemberRole | null;
  canCreateEvents: boolean;
}

export interface CreateCalendarRequest {
  name: string;
}

export interface AddCalendarMemberRequest {
  email: string;
  role: CalendarMemberRole;
}

export interface CalendarMemberResponse {
  id: string; calendarId: string; userEmail: string; userFullName: string;
  role: CalendarMemberRole; createdAt: string;
}

export interface UpdateCalendarMemberRequest { role: CalendarMemberRole; }

export interface EventResponse {
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
  amount: number | null;
  paymentStatus: PaymentStatus | null;
  paymentMethod: PaymentMethod | null;
  receivedAmount: number | null;
  paidAt: string | null;
  startsAt: string;
  endsAt: string;
}

export interface EventSearchResponse {
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
  amount?: number | null;
  startsAt: string;
  endsAt: string;
  approvalRequestedFromEmail?: string | null;
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
