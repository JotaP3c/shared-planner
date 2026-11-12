# iCalendar import and finite recurrence

Import reads uploaded iCalendar text only; it never accesses a Google account or URL.
The user supplies the external calendar identifier, destination, IANA display zone and
an explicit date window, then confirms ownership/authorization and the mapping.
Preview performs no write. Commit serializes on the destination calendar and persists
an identity over source + external calendar + UID + recurrence ID + destination.
Reimport skips existing identities rather than overwriting subsequent local edits.

Supported RFC 5545 subset: unfolded UTF-8 lines, escaped TEXT, DTSTART/DTEND/DURATION,
floating local time, UTC and standard IANA TZID, DATE with exclusive end, STATUS:CANCELLED,
RRULE DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT or UNTIL, weekly BYDAY, positive single
BYMONTHDAY, yearly single BYMONTH, all seven WKST values, EXDATE/RDATE and individual
RECURRENCE-ID overrides. Yearly February 29 occurrences are skipped in non-leap years,
never moved to February 28. Aware identities use the source instant; floating identities
use their original civil time with a FLOAT marker, so changing display zone cannot create
a second identity for the same source occurrence.
Unknown zones, unsupported recurrence properties, RANGE=THISANDFUTURE, ambiguous duplicate
masters, private/confidential records without explicit authorization and missing timed-event ends produce BLOCKED rows.
They are never approximated or silently converted to a different series. VALARM and
other non-event components do not become events. Files are not stored in the repository.

`privateEventsAuthorized` defaults to false, including the compatible seven-argument
request constructor. Opting in authorizes parsing PRIVATE/CONFIDENTIAL only when the API
also verifies management access and a PERSONAL/IMPORTED destination with exactly one
member: its owner. SHARED/LEGACY calendars and any other member (even inactive) reject
the request before event writes. A system administrator may perform an authorized
import for that owner without knowing the owner's password. The normal mapping
confirmation remains mandatory for commit; this opt-in never grants new calendar access.

Imports become PERSONAL, retaining title, description, start/end, all-day and cancellation.
`EventResponse.externalSource = GOOGLE_ICS` explicitly identifies the imported origin,
so the UI renders its actual title rather than substituting the required person field.
The required person field identifies the explicitly mapped destination owner; no owner
or client price is inferred from a title. A later deliberate CLIENT conversion must
supply the existing required service/client/amount fields. No real exports are fixtures.

Native series accept DAILY, WEEKLY, BIWEEKLY, MONTHLY and CUSTOM (weekly interval + weekdays).
They require count or until, maximum 366 events over three years. Monthly dates absent
from a month are skipped. Invalid local times in DST gaps are rejected; overlap times
use Java ZoneId's earlier offset. Database events remain civil local times, and the
series retains zoneId. Existing overlap policy is preserved: appointments may overlap;
this module does not silently add a booking-conflict prohibition. Creation returns
`conflictCount` (number of new occurrences overlapping an active event in the same
calendar); reads/updates return null when no new conflict scan was requested.

An individual occurrence uses the normal event endpoints. ALL/FUTURE updates and
cancellations call EventService for each selected occurrence in one transaction;
per-event payment integrity, approval rounds, audit and authorization remain authoritative.
Cancelled occurrences remain cancelled. No payment snapshot is copied between events.
The materialized horizon is explicit; imports outside that horizon require another
confirmed window, and the same series identity is reused.

Reference: [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545).
