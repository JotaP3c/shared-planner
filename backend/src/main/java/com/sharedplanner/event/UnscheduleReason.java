package com.sharedplanner.event;

/** Motivo informado ao desmarcar um atendimento. */
public enum UnscheduleReason {
    /** Cliente pediu nova data: o mesmo evento é remarcado (sem novo registro financeiro). */
    RESCHEDULE,
    /** Desistência / apenas desmarcou. */
    GAVE_UP,
    /** Outro motivo; exige justificativa textual. */
    OTHER
}
