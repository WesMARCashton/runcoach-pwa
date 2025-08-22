# Run Coach Progressive Web App

Run Coach is a progressive web app (PWA) designed to help you train for a faster 10‑kilometre run.  
It runs directly in a modern mobile browser and can be installed on your Android phone via “Add to Home Screen.”  
The app tracks your runs using your phone’s GPS, provides a structured 8‑week plan with five runs per week, offers guided runs with voice feedback and motivation, and automatically uploads completed runs to Strava when configured.

## Features

* **GPS‑based run tracking:** the app uses the browser’s geolocation API to record your route, distance and pace. Every 0.5 km it announces progress using the Web Speech API.
* **8‑week training plan:** each week includes five workouts (easy runs, interval sessions, tempo runs and a long run). The plan ramps up gradually to improve your 10K pace. It’s derived from advice in Runner’s World on combining long steady runs and speed work to build endurance and running economy【184266027959436†L96-L118】. Long runs should be done at an easy pace (50–85 % of max heart rate) to strengthen your aerobic system【184266027959436†L96-L118】.
* **Personal bests:** the app records all of your completed runs and calculates the fastest pace and longest distance for each day of the week.
* **Daily motivation:** a quote inspired by David Goggins’s teachings on pain, perseverance and mental toughness appears each day【337334097906803†L142-L160】. Quotes rotate through a curated list.
* **Guided runs:** choose from three guided sessions (20‑minute easy run, 30‑minute tempo run, 45‑minute long run). Each session plays timed voice prompts encouraging you and offering coaching cues. The guidance scripts incorporate Goggins’s philosophy—for example, “Don’t stop when you’re tired. Stop when you’re done”【337334097906803†L149-L155】.
* **Strava integration:** you can synchronise completed runs to Strava. To comply with Strava’s API agreement, the app only uploads activities for the signed‑in user and never displays other athletes’ data【335124566563407†L68-L90】. You must register a Strava developer application to obtain your own client ID and secret (see instructions below).

## Installation

1. **Download and extract the app:** copy the `running_app` folder to a web‑accessible location or keep it on your device.
2. **Serve over HTTP (recommended):** some browsers restrict geolocation in `file://` pages. To avoid this, run a simple web server in the `running_app` directory:

   ```bash
   python3 -m http.server 8080
   ```

   Then browse to `http://localhost:8080` on your phone (ensure both devices are on the same network).  
   Alternatively, upload the folder to any static‑site host.
3. **Add to home screen:** open the site in Chrome on Android, tap the menu (three dots) and select “Add to Home Screen.” The app will behave like a native application.

## Strava Setup

1. Create a developer application at https://www.strava.com/settings/api using your Strava account.  
2. In the form, set your “Authorization Callback Domain” to the domain or IP address where the PWA is served. For example, if you host it at `http://192.168.1.5:8080`, use `192.168.1.5`.
3. Note your **Client ID** and **Client Secret**. Enter these into the fields on the app’s home screen.
4. Click **Connect Strava**. The app will redirect you to Strava’s authorisation page. Approve the requested scope (`activity:write`) so the app can upload activities on your behalf.  
5. After authorising, the app stores your access tokens locally. Future runs will be uploaded automatically.

### Privacy and API Compliance

Strava’s API agreement highlights that developers must not replicate Strava’s functionality or share user data with others【335124566563407†L68-L90】. Run Coach uses your client credentials solely to upload activities for your account. It does not expose or process other athletes’ data and stores your tokens locally on your device.

## Usage Tips

* **Start a run:** on the home screen tap **Start Run**. Grant location permission. During the run the app displays distance, duration and pace; it announces every 0.5 km.
* **Guided runs:** tap **Guided Runs** and choose a session. The app will play voice cues at scheduled intervals.
* **Stop a run:** tap **Stop Run** to finish. The run is saved in local storage and, if connected, uploaded to Strava.
* **View personal bests:** open the **Records** tab to see your fastest paces and longest distances for each day of the week.
* **View the plan or quotes:** use the bottom navigation to access your training plan and daily motivation.

## Notes

* Geolocation on some mobile browsers requires HTTPS. If you encounter errors, consider serving the app over HTTPS or enabling insecure origins in your browser.
* The app stores data in your browser’s local storage. Clearing site data will erase your run history.