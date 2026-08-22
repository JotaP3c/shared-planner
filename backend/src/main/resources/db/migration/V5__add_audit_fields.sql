ALTER TABLE users
    ADD COLUMN created_by_user_id UUID NULL, ADD COLUMN updated_by_user_id UUID NULL,
    ADD CONSTRAINT fk_users_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users (id),
    ADD CONSTRAINT fk_users_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users (id);

ALTER TABLE calendars
    ADD COLUMN created_by_user_id UUID NULL, ADD COLUMN updated_at TIMESTAMP NULL,
    ADD COLUMN updated_by_user_id UUID NULL;
UPDATE calendars SET created_by_user_id = owner_user_id WHERE created_by_user_id IS NULL;
ALTER TABLE calendars
    ADD CONSTRAINT fk_calendars_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users (id),
    ADD CONSTRAINT fk_calendars_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users (id);

ALTER TABLE calendar_members
    ADD COLUMN created_by_user_id UUID NULL, ADD COLUMN updated_at TIMESTAMP NULL,
    ADD COLUMN updated_by_user_id UUID NULL,
    ADD CONSTRAINT fk_calendar_members_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users (id),
    ADD CONSTRAINT fk_calendar_members_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users (id);

ALTER TABLE events ADD COLUMN updated_by_user_id UUID NULL;
UPDATE events SET updated_by_user_id = created_by_user_id WHERE updated_by_user_id IS NULL;
ALTER TABLE events ADD CONSTRAINT fk_events_updated_by_user FOREIGN KEY (updated_by_user_id) REFERENCES users (id);
