package expo.modules.anchorsms

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Reads bank alerts from the SMS inbox. Filtering by sender happens here, so
// personal messages never cross into JavaScript.
class AnchorSmsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun granted(): Boolean =
    context.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED

  private fun queryInbox(sinceMillis: Long, keywords: List<String>, limit: Int): List<Map<String, Any>> {
    val results = mutableListOf<Map<String, Any>>()
    val cursor = context.contentResolver.query(
      Uri.parse("content://sms/inbox"),
      arrayOf("_id", "address", "body", "date"),
      "date > ?",
      arrayOf(sinceMillis.toString()),
      "date DESC"
    ) ?: return results
    try {
      val idIdx = cursor.getColumnIndexOrThrow("_id")
      val addressIdx = cursor.getColumnIndexOrThrow("address")
      val bodyIdx = cursor.getColumnIndexOrThrow("body")
      val dateIdx = cursor.getColumnIndexOrThrow("date")
      while (cursor.moveToNext() && results.size < limit) {
        val address = cursor.getString(addressIdx) ?: ""
        val matches = keywords.isEmpty() || keywords.any { address.contains(it, ignoreCase = true) }
        if (matches) {
          results.add(
            mapOf(
              "id" to cursor.getLong(idIdx).toString(),
              "address" to address,
              "body" to (cursor.getString(bodyIdx) ?: ""),
              "date" to cursor.getLong(dateIdx).toDouble()
            )
          )
        }
      }
    } finally {
      cursor.close()
    }
    return results
  }

  override fun definition() = ModuleDefinition {
    Name("AnchorSms")

    Function("hasPermission") {
      granted()
    }

    Function("hasReceivePermission") {
      context.checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
    }

    Function("configureAlerts") { enabled: Boolean, senders: List<String> ->
      context.getSharedPreferences(AlertPrefs.NAME, Context.MODE_PRIVATE)
        .edit()
        .putBoolean(AlertPrefs.ENABLED, enabled)
        .putString(AlertPrefs.SENDERS, senders.joinToString("\n"))
        .apply()
    }

    AsyncFunction("readInbox") { sinceMillis: Double, senderKeywords: List<String>, limit: Int ->
      val keywords = senderKeywords.map { it.trim() }.filter { it.isNotEmpty() }
      if (granted()) queryInbox(sinceMillis.toLong(), keywords, limit) else emptyList()
    }
  }
}
