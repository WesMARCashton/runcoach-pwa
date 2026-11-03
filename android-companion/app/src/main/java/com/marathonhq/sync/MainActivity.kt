package com.marathonhq.sync

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.EditText
import androidx.work.*
import java.util.concurrent.TimeUnit
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
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
    private lateinit var pairId: EditText
    private lateinit var code: EditText
    private val permissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted -> if (permission in granted) readWorkouts() else status.text = "Exercise permission required" }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(36, 56, 36, 36) }
        status = TextView(this).apply { text = "Marathon HQ Companion\nRead-only Health Connect workout preview"; textSize = 18f }
        layout.addView(status)
        pairId = EditText(this).apply { hint = "Pair ID from Marathon HQ"; setSingleLine(true) }
        code = EditText(this).apply { hint = "Six-digit pairing code"; inputType = 2; setSingleLine(true) }
        layout.addView(pairId)
        layout.addView(code)
        layout.addView(Button(this).apply { text = "Pair with Marathon HQ"; setOnClickListener { pairDevice() } })
        layout.addView(Button(this).apply { text = "Sync workouts now"; setOnClickListener { syncNow() } })
        WorkManager.getInstance(this).enqueueUniquePeriodicWork("health-sync", ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<WorkoutWorker>(15, TimeUnit.MINUTES).build())
        layout.addView(Button(this).apply { text = "Grant Health Connect permission"; setOnClickListener { permissionLauncher.launch(setOf(permission)) } })
        layout.addView(Button(this).apply { text = "Read recent workouts"; setOnClickListener { readWorkouts() } })
        setContentView(layout)
    }

    private fun pairDevice() {
        val id=pairId.text.toString().trim()
        val pin=code.text.toString().trim()
        status.text = "Pairing…"
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val response=withContext(Dispatchers.IO) {
                    val conn=URL("https://marathon-hq-production.up.railway.app/api/pair/claim").openConnection() as HttpURLConnection
                    conn.requestMethod="POST"; conn.doOutput=true; conn.setRequestProperty("Content-Type","application/json")
                    conn.connectTimeout=12000; conn.readTimeout=12000
                    conn.outputStream.use { it.write(JSONObject().put("pairId",id).put("code",pin).toString().toByteArray()) }
                    val text=(if(conn.responseCode in 200..299)conn.inputStream else conn.errorStream).bufferedReader().readText()
                    if(conn.responseCode !in 200..299)throw Exception(text)
                    JSONObject(text).getString("deviceToken")
                }
                getSharedPreferences("sync",MODE_PRIVATE).edit().putString("deviceToken",response).apply()
                status.text="Paired. Tap Sync workouts now."
            } catch(e:Exception){status.text="Pairing failed: ${e.message}"}
        }
    }
    private fun syncNow() {
        status.text="Syncing…"
        CoroutineScope(Dispatchers.Main).launch {
            val result=withContext(Dispatchers.IO){WorkoutWorker.upload(applicationContext)}
            status.text=if(result) "Sync complete. Check Marathon HQ Running tab." else "Sync failed. Check pairing and Health Connect permissions."
        }
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
                        "${it.startTime.atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("MMM d, h:mm a"))} · ${when(it.exerciseType) { ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "Running"; ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "Walking"; else -> "Workout" }} · ${ChronoUnit.MINUTES.between(it.startTime, it.endTime)} min"
                    } + "\n\nSync to Marathon HQ will be enabled after secure account pairing."
            } catch (e: Exception) {
                status.text = "Unable to read workouts: ${e.message}"
            }
        }
    }
}
