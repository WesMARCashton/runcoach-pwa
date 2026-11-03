package com.marathonhq.sync

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.temporal.ChronoUnit

class MainActivity : ComponentActivity() {
    private val permission = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
    private lateinit var status: TextView
    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted -> if (permission in granted) readWorkouts() else status.text = "Exercise permission required" }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(36, 56, 36, 36) }
        status = TextView(this).apply { text = "Marathon HQ Companion\nRead-only Health Connect workout preview"; textSize = 18f }
        layout.addView(status)
        layout.addView(Button(this).apply { text = "Grant Health Connect permission"; setOnClickListener { permissionLauncher.launch(setOf(permission)) } })
        layout.addView(Button(this).apply { text = "Read recent workouts"; setOnClickListener { readWorkouts() } })
        setContentView(layout)
    }

    private fun readWorkouts() {
        if (HealthConnectClient.getSdkStatus(this) != HealthConnectClient.SDK_AVAILABLE) {
            status.text = "Health Connect unavailable on this device"
            return
        }
        val client = HealthConnectClient.getOrCreate(this)
        CoroutineScope(Dispatchers.Main).launch {
            try {
                if (permission !in client.permissionController.getGrantedPermissions()) {
                    permissionLauncher.launch(setOf(permission))
                    return@launch
                }
                val entries = withContext(Dispatchers.IO) {
                    client.readRecords(ReadRecordsRequest(
                        ExerciseSessionRecord::class,
                        timeRangeFilter = TimeRangeFilter.after(Instant.now().minus(30, ChronoUnit.DAYS)),
                        pageSize = 100
                    )).records
                }
                status.text = "Found ${entries.size} workouts in past 30 days:\n" +
                    entries.sortedByDescending { it.startTime }.take(20).joinToString("\n") {
                        "${it.startTime} · ${it.exerciseType} · ${ChronoUnit.MINUTES.between(it.startTime, it.endTime)} min"
                    } + "\n\nSync to Marathon HQ will be enabled after secure account pairing."
            } catch (e: Exception) {
                status.text = "Unable to read workouts: ${e.message}"
            }
        }
    }
}
