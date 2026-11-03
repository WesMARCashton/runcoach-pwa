package com.marathonhq.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.temporal.ChronoUnit

class WorkoutWorker(context:Context, params:WorkerParameters):CoroutineWorker(context,params){
    override suspend fun doWork():Result = if(upload(applicationContext)) Result.success() else Result.retry()
    companion object {
        suspend fun upload(context:Context):Boolean = withContext(Dispatchers.IO) {
            try {
                val token=context.getSharedPreferences("sync",Context.MODE_PRIVATE).getString("deviceToken",null)
                    ?: return@withContext false
                if(HealthConnectClient.getSdkStatus(context)!=HealthConnectClient.SDK_AVAILABLE)return@withContext false
                val client=HealthConnectClient.getOrCreate(context)
                val permission=HealthPermission.getReadPermission(ExerciseSessionRecord::class)
                if(permission !in client.permissionController.getGrantedPermissions())return@withContext false
                val workouts=JSONArray()
                var page:String?=null
                var total=0
                do {
                    val response=client.readRecords(ReadRecordsRequest(
                        ExerciseSessionRecord::class,
                        timeRangeFilter=TimeRangeFilter.after(Instant.now().minus(30,ChronoUnit.DAYS)),
                        pageSize=100,pageToken=page
                    ))
                    for (w in response.records){
                        val type=when(w.exerciseType){
                            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING->"running"
                            ExerciseSessionRecord.EXERCISE_TYPE_WALKING->"walking"
                            else->"other"
                        }
                        workouts.put(JSONObject().put("id",w.metadata.id).put("type",type)
                            .put("start",w.startTime.toEpochMilli()).put("end",w.endTime.toEpochMilli()))
                    }
                    total+=response.records.size
                    page=response.pageToken
                }while(page!=null && total<500)
                var offset=0
                while(offset<workouts.length()){
                    val chunk=JSONArray()
                    for(i in offset until minOf(offset+100,workouts.length()))chunk.put(workouts.get(i))
                    val conn=URL("https://marathon-hq-production.up.railway.app/api/workouts/sync").openConnection() as HttpURLConnection
                    conn.requestMethod="POST";conn.doOutput=true
                    conn.setRequestProperty("Content-Type","application/json")
                    conn.setRequestProperty("Authorization","Bearer $token")
                    conn.connectTimeout=15000;conn.readTimeout=15000
                    conn.outputStream.use{it.write(JSONObject().put("workouts",chunk).toString().toByteArray())}
                    val code=conn.responseCode
                    conn.disconnect()
                    if(code !in 200..299)return@withContext false
                    offset+=100
                }
                true
            }catch(e:Exception){android.util.Log.e("MarathonHQ","Workout sync failed",e);false}
        }
    }
}
