ALTER TABLE users DROP CONSTRAINT uk_users_email;
CREATE UNIQUE INDEX uk_users_email_ci ON users (lower(email));
