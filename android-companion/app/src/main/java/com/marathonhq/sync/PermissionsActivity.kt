package com.marathonhq.sync

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class PermissionsActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply {
            text = "Marathon HQ requests read-only access to your exercise sessions to analyze glucose patterns around workouts. No data is uploaded until you pair your account."
            textSize = 18f
            setPadding(36, 48, 36, 36)
        })
    }
}
