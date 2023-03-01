export const enum VerificationEventTypes {
    Request = "m.key.verification.request",
    Ready = "m.key.verification.ready",
    Start = "m.key.verification.start",
    Accept = "m.key.verification.accept",
    Key = "m.key.verification.key",
    Cancel = "m.key.verification.cancel",
}

export const enum CancelTypes {
    UserCancelled = "m.user",
    TimedOut = "m.timeout",
    UnknownTransaction = "m.unknown_transaction",
    UnknownMethod = "m.unknown_method",
    UnexpectedMessage = "m.unexpected_message",
    KeyMismatch = "m.key_mismatch",
    UserMismatch = "m.user_mismatch",
    InvalidMessage = "m.invalid_message",
    OtherUserAccepted = "m.accepted",
}
