ALTER TABLE dbo.events
ADD payment_status NVARCHAR(30) NOT NULL
        CONSTRAINT df_events_payment_status DEFAULT ('PENDING'),
    payment_method NVARCHAR(30) NULL,
    received_amount DECIMAL(12, 2) NOT NULL
        CONSTRAINT df_events_received_amount DEFAULT (0),
    paid_at DATETIME2 NULL;
GO

ALTER TABLE dbo.events
ADD CONSTRAINT ck_events_received_amount
CHECK (received_amount >= 0);
GO
