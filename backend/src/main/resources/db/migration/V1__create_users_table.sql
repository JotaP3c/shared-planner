-- PostgreSQL reference:
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- CREATE TABLE users (
--     id UUID NOT NULL DEFAULT gen_random_uuid(),
--     full_name VARCHAR(120) NOT NULL,
--     email VARCHAR(180) NOT NULL,
--     password_hash VARCHAR(255) NOT NULL,
--     role VARCHAR(30) NOT NULL DEFAULT 'USER',
--     active BOOLEAN NOT NULL DEFAULT TRUE,
--     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP NULL,
--
--     CONSTRAINT pk_users PRIMARY KEY (id),
--     CONSTRAINT uk_users_email UNIQUE (email)
-- );

-- SQL Server (active)
CREATE TABLE users (
    id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    full_name NVARCHAR(120) NOT NULL,
    email NVARCHAR(180) NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    role NVARCHAR(30) NOT NULL DEFAULT 'USER',
    active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NULL,

    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
);
