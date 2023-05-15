export const enum VerificationEventType {
    Request = "m.key.verification.request",
    Ready = "m.key.verification.ready",
    Start = "m.key.verification.start",
    Accept = "m.key.verification.accept",
    Key = "m.key.verification.key",
    Cancel = "m.key.verification.cancel",
    Mac = "m.key.verification.mac",
    Done = "m.key.verification.done",
}

export const enum CancelReason {
    UserCancelled = "m.user",
    TimedOut = "m.timeout",
    UnknownTransaction = "m.unknown_transaction",
    UnknownMethod = "m.unknown_method",
    UnexpectedMessage = "m.unexpected_message",
    KeyMismatch = "m.key_mismatch",
    UserMismatch = "m.user_mismatch",
    InvalidMessage = "m.invalid_message",
    OtherDeviceAccepted = "m.accepted",
    // SAS specific
    MismatchedCommitment = "m.mismatched_commitment",
    MismatchedSAS = "m.mismatched_sas",
}
