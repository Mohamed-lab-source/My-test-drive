package expo.modules.anchorsms

// Shared between the JS-facing module (which writes the user's choices) and
// the SMS receiver (which runs without the app and only reads them).
object AlertPrefs {
  const val NAME = "anchor_sms_alerts"
  const val ENABLED = "enabled"
  const val SENDERS = "senders"
}
