-- Back up and preflight the target before applying. No legacy row is rewritten.
-- NOT VALID followed by VALIDATE keeps the migration atomic: incompatible legacy
-- states abort deployment rather than silently changing amounts or payment history.
ALTER TABLE events ADD CONSTRAINT ck_events_financial_state CHECK (
    (event_type = 'CLIENT' AND amount IS NOT NULL AND received_amount <= amount AND (
        (payment_status = 'PENDING' AND received_amount = 0 AND paid_at IS NULL)
        OR (payment_status = 'PARTIALLY_PAID' AND received_amount > 0 AND received_amount < amount
            AND payment_method IS NOT NULL AND paid_at IS NOT NULL)
        OR (payment_status = 'PAID' AND received_amount = amount
            AND payment_method IS NOT NULL AND paid_at IS NOT NULL)
        OR (payment_status = 'REFUNDED' AND received_amount = 0)
    ))
    OR (event_type IN ('PERSONAL', 'SHARED') AND payment_status = 'PENDING'
        AND received_amount = 0 AND payment_method IS NULL AND paid_at IS NULL)
) NOT VALID;
ALTER TABLE events VALIDATE CONSTRAINT ck_events_financial_state;
