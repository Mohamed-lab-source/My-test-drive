package expo.modules.anchorsms

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Telephony

class SmsDebitReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val prefs = context.getSharedPreferences(AlertPrefs.NAME, Context.MODE_PRIVATE)
    if (!prefs.getBoolean(AlertPrefs.ENABLED, false)) return
    val senders = (prefs.getString(AlertPrefs.SENDERS, "") ?: "")
      .split("\n")
      .map { it.trim() }
      .filter { it.isNotEmpty() }

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
    // A long SMS arrives in parts; stitch them back together per sender.
    val bySender = linkedMapOf<String, StringBuilder>()
    for (part in messages) {
      val address = part.originatingAddress ?: continue
      bySender.getOrPut(address) { StringBuilder() }.append(part.messageBody ?: "")
    }
    for ((address, body) in bySender) {
      val matchesSender = senders.isEmpty() || senders.any { address.contains(it, ignoreCase = true) }
      if (matchesSender && looksLikeDebit(body.toString())) {
        notify(context, body.toString())
      }
    }
  }

  private fun looksLikeDebit(body: String): Boolean {
    if (IGNORE.containsMatchIn(body)) return false
    return AMOUNT.containsMatchIn(body) && DEBIT.containsMatchIn(body)
  }

  private fun notify(context: Context, body: String) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Bank alerts", NotificationManager.IMPORTANCE_DEFAULT)
      )
    }
    val open = Intent(Intent.ACTION_VIEW, Uri.parse("anchor://money/sms-inbox")).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val pending = PendingIntent.getActivity(
      context,
      0,
      open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }
    val text = if (body.length > 180) body.take(177) + "…" else body
    val notification = builder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle("New card payment — tap to review")
      .setContentText(text)
      .setStyle(Notification.BigTextStyle().bigText(text))
      .setContentIntent(pending)
      .setAutoCancel(true)
      .build()
    try {
      manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
    } catch (e: SecurityException) {
      // Notification permission not granted; the debit still shows in the app.
    }
  }

  companion object {
    private const val CHANNEL_ID = "anchor-bank-alerts"
    private val AMOUNT = Regex(
      "(EGP|USD|EUR|GBP|AED|SAR|KWD|QAR|BHD|OMR|JOD|LE|L\\.E|جنيه|درهم|ريال)\\s?[\\d٠-٩,.]+|[\\d٠-٩,.]+\\s?(EGP|USD|EUR|GBP|AED|SAR|KWD|QAR|BHD|OMR|JOD|LE|جنيه|درهم|ريال)",
      RegexOption.IGNORE_CASE
    )
    private val DEBIT = Regex(
      "debited|purchase|used|spent|paid|withdraw|charged|deducted|خصم|سحب|شراء",
      RegexOption.IGNORE_CASE
    )
    private val IGNORE = Regex(
      "otp|one[- ]?time|password|passcode|verification|declined|failed|unsuccessful|statement|will be (debited|charged)|credited|رمز|كلمة المرور|مرفوض",
      RegexOption.IGNORE_CASE
    )
  }
}
