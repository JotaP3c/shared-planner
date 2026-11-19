CREATE TABLE catalog_items (
    id UUID PRIMARY KEY,
    calendar_id UUID NOT NULL REFERENCES calendars(id),
    name VARCHAR(180) NOT NULL CHECK (length(trim(name)) > 0),
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('SERVICE', 'PRODUCT')),
    code VARCHAR(60),
    description VARCHAR(2000),
    category VARCHAR(100),
    duration_minutes INTEGER CHECK (duration_minutes BETWEEN 1 AND 1440),
    standard_price NUMERIC(12,2) NOT NULL CHECK (standard_price >= 0),
    promotional_price NUMERIC(12,2),
    promotion_start_date DATE,
    promotion_end_date DATE,
    active BOOLEAN NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT ck_catalog_item_promotion CHECK (
        (promotional_price IS NULL AND promotion_start_date IS NULL AND promotion_end_date IS NULL)
        OR (promotional_price IS NOT NULL AND promotional_price >= 0 AND promotional_price < standard_price
            AND promotion_start_date IS NOT NULL AND promotion_end_date IS NOT NULL
            AND promotion_start_date <= promotion_end_date)
    )
);

CREATE INDEX ix_catalog_items_calendar_active_name ON catalog_items(calendar_id, active, name, id);
CREATE INDEX ix_catalog_items_calendar_code ON catalog_items(calendar_id, code);

CREATE TABLE catalog_price_history (
    id UUID PRIMARY KEY,
    catalog_item_id UUID NOT NULL REFERENCES catalog_items(id),
    standard_price NUMERIC(12,2) NOT NULL,
    promotional_price NUMERIC(12,2),
    promotion_start_date DATE,
    promotion_end_date DATE,
    changed_at TIMESTAMP NOT NULL,
    changed_by_user_id UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX ix_catalog_price_history_item_changed ON catalog_price_history(catalog_item_id, changed_at DESC, id);

CREATE TABLE event_catalog_items (
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    catalog_item_id UUID NOT NULL REFERENCES catalog_items(id),
    item_name VARCHAR(180) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 999),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    discount NUMERIC(12,2) NOT NULL CHECK (discount >= 0),
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal = unit_price * quantity),
    duration_minutes INTEGER CHECK (duration_minutes BETWEEN 1 AND 1440),
    PRIMARY KEY (event_id, position),
    UNIQUE (event_id, catalog_item_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX ix_event_catalog_items_catalog_item ON event_catalog_items(catalog_item_id);

-- Add gates to standard global profiles and appropriate native calendar profiles.
-- Existing custom profiles retain their explicit grants.
INSERT INTO access_profile_permissions(profile_id, permission)
SELECT p.id, grants.permission
FROM access_profiles p CROSS JOIN (VALUES ('CATALOG_VIEW'), ('CATALOG_MANAGE')) AS grants(permission)
WHERE p.built_in AND (p.code IN ('SYSTEM_ADMIN', 'SYSTEM_FINANCE', 'USER', 'CALENDAR_ADMIN')
    OR (p.code = 'CALENDAR_FINANCE' AND grants.permission = 'CATALOG_VIEW'));
