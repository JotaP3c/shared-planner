package com.sharedplanner.access;

/** One catalog for module gates and contextual data authorization. */
public enum Permission {
    CALENDAR_VIEW("Calendário", "Visualizar calendário", false),
    CALENDAR_CREATE("Calendário", "Criar calendário compartilhado", true),
    EVENT_CREATE("Calendário", "Criar eventos", false),
    EVENT_EDIT("Calendário", "Editar eventos próprios", false),
    EVENT_EDIT_ALL("Calendário", "Editar eventos de outros membros", false),
    EVENT_CANCEL("Calendário", "Cancelar eventos", false),
    EVENT_APPROVE("Calendário", "Responder aprovações designadas", false),
    FINANCE_VIEW("Financeiro", "Consultar financeiro", false),
    FINANCE_VIEW_OWN("Financeiro", "Consultar valores dos próprios eventos", false),
    FINANCE_MANAGE("Financeiro", "Registrar pagamentos", false),
    FINANCE_MANAGE_OWN("Financeiro", "Registrar pagamentos dos próprios eventos", false),
    FINANCE_EXPORT("Financeiro", "Exportar relatórios Excel", false),
    FINANCE_MEMBER_CALENDARS("Financeiro", "Consultar financeiro dos calendários dos quais participa", true),
    MEMBERS_VIEW("Administração", "Visualizar membros", false),
    MEMBERS_MANAGE("Administração", "Gerenciar acessos do calendário", false),
    USERS_VIEW("Administração", "Consultar usuários globais", true),
    USERS_MANAGE("Administração", "Administrar usuários globais", true),
    ROLES_MANAGE("Administração", "Gerenciar perfis globais", true),
    AUDIT_VIEW("Administração", "Consultar auditoria", false),
    AUDIT_VIEW_ALL("Administração", "Consultar auditoria de todo o sistema", true),
    CALENDAR_IMPORT("Administração", "Importar calendários autorizados", false),
    SETTINGS_VIEW("Configurações", "Consultar configurações", true);

    private final String module;
    private final String label;
    private final boolean globalOnly;
    Permission(String module, String label, boolean globalOnly) {
        this.module = module; this.label = label; this.globalOnly = globalOnly;
    }
    public String module() { return module; }
    public String label() { return label; }
    public boolean globalOnly() { return globalOnly; }
}
