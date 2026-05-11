USE shared_planner_dev;

DELETE FROM shared_planner_dev.dbo.events
WHERE calendar_id = '33333333-3333-3333-3333-333333333333';

DELETE FROM shared_planner_dev.dbo.calendar_members
WHERE calendar_id = '33333333-3333-3333-3333-333333333333'
   OR user_id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222'
   );

DELETE FROM shared_planner_dev.dbo.calendars
WHERE id = '33333333-3333-3333-3333-333333333333';

DELETE FROM shared_planner_dev.dbo.users
WHERE id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222'
   )
   OR email IN (
        'jpcbnnu@gmail.com',
        'esposa@example.com'
   );

INSERT INTO shared_planner_dev.dbo.users (
    id,
    full_name,
    email,
    password_hash,
    role,
    active,
    created_at
)
VALUES
    (
        '11111111-1111-1111-1111-111111111111',
        'Joao Correa',
        'jpcbnnu@gmail.com',
        '$2a$10$DMO6/G6HOHknCpL5fS5w/eg9eS6g.fAhFrtoVrbsutUX3XsjzlH9i',
        'USER',
        1,
        SYSUTCDATETIME()
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        'Esposa Teste',
        'esposa@example.com',
        '$2a$10$DMO6/G6HOHknCpL5fS5w/eg9eS6g.fAhFrtoVrbsutUX3XsjzlH9i',
        'USER',
        1,
        SYSUTCDATETIME()
    );

INSERT INTO shared_planner_dev.dbo.calendars (
    id,
    name,
    owner_user_id,
    created_at
)
VALUES (
    '33333333-3333-3333-3333-333333333333',
    'Agenda Compartilhada',
    '11111111-1111-1111-1111-111111111111',
    SYSUTCDATETIME()
);

INSERT INTO shared_planner_dev.dbo.calendar_members (
    id,
    calendar_id,
    user_id,
    member_role,
    created_at
)
VALUES
    (
        NEWID(),
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        'OWNER',
        SYSUTCDATETIME()
    ),
    (
        NEWID(),
        '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'MEMBER',
        SYSUTCDATETIME()
    );

INSERT INTO shared_planner_dev.dbo.events (
    id,
    calendar_id,
    created_by_user_id,
    approval_requested_from_user_id,
    approved_by_user_id,
    event_type,
    status,
    title,
    client_name,
    person_name,
    description,
    work_description,
    amount,
    payment_status,
    payment_method,
    received_amount,
    paid_at,
    starts_at,
    ends_at,
    created_at,
    updated_at
)
VALUES
    (
        '44444444-4444-4444-4444-444444444444',
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        NULL,
        NULL,
        'CLIENT',
        'SCHEDULED',
        'Cliente Maria - Sobrancelha',
        'Maria',
        NULL,
        'Atendimento de sobrancelha',
        'Design de sobrancelha',
        50.00,
        'PAID',
        'PIX',
        50.00,
        '2026-05-08T14:35:00',
        '2026-05-08T14:00:00',
        '2026-05-08T14:30:00',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    ),
    (
        '55555555-5555-5555-5555-555555555555',
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        NULL,
        NULL,
        'CLIENT',
        'SCHEDULED',
        'Cliente Ana - Cabelo',
        'Ana',
        NULL,
        'Atendimento de cabelo',
        'Escova e finalizacao',
        70.00,
        'PENDING',
        NULL,
        0.00,
        NULL,
        '2026-05-08T15:00:00',
        '2026-05-08T16:00:00',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    ),
    (
        '66666666-6666-6666-6666-666666666666',
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        NULL,
        NULL,
        'CLIENT',
        'SCHEDULED',
        'Cliente Clara - Maquiagem',
        'Clara',
        NULL,
        'Maquiagem para evento',
        'Maquiagem social',
        120.00,
        'PARTIALLY_PAID',
        'CREDIT_CARD',
        60.00,
        '2026-05-09T11:20:00',
        '2026-05-09T10:00:00',
        '2026-05-09T11:30:00',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    ),
    (
        '77777777-7777-7777-7777-777777777777',
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        NULL,
        NULL,
        'PERSONAL',
        'SCHEDULED',
        'Futebol',
        NULL,
        'Joao',
        'Futebol com amigos',
        NULL,
        NULL,
        'PENDING',
        NULL,
        0.00,
        NULL,
        '2026-05-09T20:00:00',
        '2026-05-09T21:30:00',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    ),
    (
        '88888888-8888-8888-8888-888888888888',
        '33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        NULL,
        'SHARED',
        'PENDING_APPROVAL',
        'Evento compartilhado',
        NULL,
        'Joao',
        'Evento que depende da aprovacao de outro membro',
        NULL,
        NULL,
        'PENDING',
        NULL,
        0.00,
        NULL,
        '2026-05-10T10:00:00',
        '2026-05-10T11:00:00',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    );

SELECT
    'Seed completed' AS result,
    '33333333-3333-3333-3333-333333333333' AS calendar_id,
    '44444444-4444-4444-4444-444444444444' AS client_paid_event_id,
    '55555555-5555-5555-5555-555555555555' AS client_pending_event_id,
    '66666666-6666-6666-6666-666666666666' AS client_partial_event_id,
    '77777777-7777-7777-7777-777777777777' AS personal_event_id,
    '88888888-8888-8888-8888-888888888888' AS shared_event_id,
    'admin' AS default_password;
