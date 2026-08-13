package com.findfam.mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)

        // A notification channel's importance is fixed the moment it's
        // first created — Android ignores any later attempt to raise it.
        // Must exist at IMPORTANCE_HIGH before the first SOS push arrives,
        // or FCM (or Android itself) auto-creates it at IMPORTANCE_DEFAULT
        // and every install from that point on gets a silent, no-heads-up
        // notification with no error anywhere to explain why.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "sos_alerts",
                "SOS Alerts",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Alerts when a circle member triggers an SOS"
            }
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
