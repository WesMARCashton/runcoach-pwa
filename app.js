/*
 * Main script for the Run Coach PWA
 * Handles navigation, training plan display, running session tracking,
 * personal records computation, motivational quotes and guided run functionality.
 */

// Register service worker for offline capability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(console.error);
}

// Global state
let runs = [];
let trainingPlan = [];
let quotes = [];
let guidedRuns = [];
let stories = [];

// Run session variables
let runTimer = null;
let runStartTime = null;
let runDistance = 0;
let runWatchId = null;
let lastPosition = null;
let halfKmSegments = 0;
let guidedSchedule = null;

document.addEventListener('DOMContentLoaded', () => {
  initData();
  initNavigation();
  loadStoredRuns();
  renderTodayPlan();
  renderPlan();
  renderRecords();
  renderQuote();
  renderHistory();
  renderGuidedList();
  initStrava();
  displayStravaStatus();
});

/**
 * Initialize static data such as the training plan, motivational quotes and guided runs.
 */
function initData() {
  // Define an 8‑week training plan with 5 runs per week.
  // Each entry: type (easy, interval, tempo, long), description.
  trainingPlan = [
    // Week 1
    [
      { type: 'Easy', description: '5 km easy run' },
      { type: 'Intervals', description: '4×400 m at 5K pace with 200 m jog recovery' },
      { type: 'Easy', description: '5 km easy run' },
      { type: 'Tempo', description: '20 min tempo run at comfortably hard pace' },
      { type: 'Long', description: '7 km long run at comfortable pace' }
    ],
    // Week 2
    [
      { type: 'Easy', description: '5 km easy run' },
      { type: 'Intervals', description: '5×400 m at 5K pace with 200 m jog recovery' },
      { type: 'Easy', description: '6 km easy run' },
      { type: 'Tempo', description: '25 min tempo run' },
      { type: 'Long', description: '8 km long run' }
    ],
    // Week 3
    [
      { type: 'Easy', description: '6 km easy run' },
      { type: 'Intervals', description: '3×800 m at 10K pace with 400 m jog recovery' },
      { type: 'Easy', description: '6 km easy run' },
      { type: 'Tempo', description: '30 min tempo run' },
      { type: 'Long', description: '9 km long run' }
    ],
    // Week 4
    [
      { type: 'Easy', description: '6 km easy run' },
      { type: 'Intervals', description: '6×400 m at 5K pace with 200 m jog recovery' },
      { type: 'Easy', description: '7 km easy run' },
      { type: 'Tempo', description: '30 min tempo run' },
      { type: 'Long', description: '10 km long run' }
    ],
    // Week 5
    [
      { type: 'Easy', description: '7 km easy run' },
      { type: 'Intervals', description: '4×800 m at 10K pace with 400 m recovery' },
      { type: 'Easy', description: '7 km easy run' },
      { type: 'Tempo', description: '35 min tempo run' },
      { type: 'Long', description: '11 km long run' }
    ],
    // Week 6
    [
      { type: 'Easy', description: '7 km easy run' },
      { type: 'Intervals', description: '5×800 m at 10K pace with 400 m recovery' },
      { type: 'Easy', description: '8 km easy run' },
      { type: 'Tempo', description: '35 min tempo run' },
      { type: 'Long', description: '12 km long run' }
    ],
    // Week 7
    [
      { type: 'Easy', description: '8 km easy run' },
      { type: 'Intervals', description: '8×400 m at 5K pace with 200 m recovery' },
      { type: 'Easy', description: '8 km easy run' },
      { type: 'Tempo', description: '40 min tempo run' },
      { type: 'Long', description: '12 km long run with final 3 km at 10K pace' }
    ],
    // Week 8 (taper week)
    [
      { type: 'Easy', description: '5 km easy run' },
      { type: 'Intervals', description: '4×400 m at 5K pace' },
      { type: 'Easy', description: '4 km easy run' },
      { type: 'Tempo', description: '15 min tempo run' },
      { type: 'Long', description: '10 km race day simulation' }
    ]
  ];

  // Motivational quotes focusing on sports and personal growth, including David Goggins wisdom.
  // Quotes taken from public articles summarising his insights on pushing through pain and mental toughness【337334097906803†L142-L159】.
  quotes = [
    'Pain unlocks a secret doorway in your mind that leads to peak performance and beautiful silence.',
    'The most important conversations you’ll ever have are the ones you’ll have with yourself.',
    'Don’t stop when you’re tired. Stop when you’re done.',
    'Everyone wants to be successful, but not everyone is willing to suffer for it.',
    'You are in danger of living a life so comfortable and soft that you will die without ever realizing your true potential.',
    'The human body can withstand and accomplish far more than most of us think possible.',
    'You have to build calluses on your brain, just like how you build calluses on your hands.',
    'Motivation gets you out the door. Discipline keeps you going.',
    'The mind is the most important thing. It’s the only thing that can overcome anything.',
    'If you’re weak mentally, your body will wilt too.'
  ];

  // Inspiring stories and running advice for continuous guided sessions. Each entry
  // contains a list of segments that can be interspersed throughout a run. The
  // content is derived from credible sources. For example, David Goggins grew
  // up in an abusive household and was overweight, but he turned his life
  // around by losing 106 pounds in less than three months to qualify for Navy
  // SEAL training. He is believed to be the only member of the armed forces
  // to complete the Basic Underwater Demolition/SEAL course, Army Ranger
  // School and Air Force Tactical Air Controller training【868247862005850†L86-L117】. Today he
  // continues to run up to 30 miles every day and has completed more than
  // 60 ultramarathons【868247862005850†L133-L162】.
  //
  // Eliud Kipchoge is considered the greatest marathoner of all time. Born
  // on a farm in Kenya, he overcame a modest upbringing and became the first
  // person to run a marathon distance in under two hours (1:59:40 in 2019)
  //【364251690127242†L50-L76】. He holds the official world record after running
  // 2:01:39 at the 2018 Berlin Marathon and lowering it to 2:01:09 in 2022【364251690127242†L90-L101】.
  // He won back‑to‑back Olympic marathon gold medals and emphasises that
  // running is about the heart and mind as much as the legs【364251690127242†L72-L76】【364251690127242†L108-L112】.
  //
  // Kathrine Switzer became the first woman to officially finish the Boston
  // Marathon in 1967. Entering under her initials “K.V. Switzer,” she was
  // attacked mid‑race by the race director, who tried to rip off her bib
  // number, but she persisted and completed the race【935647409499177†L92-L122】. She went on
  // to run more than 40 marathons, won the 1974 New York City Marathon and
  // helped get the women’s marathon included in the Olympic Games【935647409499177†L129-L152】.
  // Switzer uses running as a platform to empower women and believes adversity
  // can be turned into opportunity【935647409499177†L129-L142】.
  stories = [
    {
      title: 'David Goggins – Relentless Endurance',
      segments: [
        'Let’s draw inspiration from David Goggins. Born into hardship and obesity, he decided to change his life. He dropped over a hundred pounds in three months to qualify for Navy SEAL training【868247862005850†L86-L117】.',
        'Goggins is believed to be the only person to complete the SEAL BUD/S program three times, Army Ranger School and Air Force tactical air controller training【868247862005850†L86-L117】.',
        'Today he runs between eight and 30 miles every day and has finished more than 60 ultramarathons【868247862005850†L133-L162】. His story reminds us that mental toughness can take us far beyond what we think is possible.'
      ]
    },
    {
      title: 'Eliud Kipchoge – Master of the Marathon',
      segments: [
        'Eliud Kipchoge grew up on a farm in Kenya. He showed promise as a teenager, winning the 5,000‑metre world title at just 18 years old【364251690127242†L77-L81】.',
        'He made history in 2019 by becoming the first person to run a marathon in under two hours, clocking 1:59:40【364251690127242†L50-L76】.',
        'Kipchoge holds the official world record of 2:01:39 from Berlin 2018 and lowered it to 2:01:09 in 2022【364251690127242†L90-L101】. He says running is about the heart and mind as much as the legs【364251690127242†L72-L76】【364251690127242†L108-L112】.'
      ]
    },
    {
      title: 'Kathrine Switzer – Breaking Barriers',
      segments: [
        'In 1967 Kathrine Switzer entered the Boston Marathon as “K.V. Switzer.” Mid‑race, the director tried to pull her off the course. She fought him off and finished, becoming the first woman to officially complete the race【935647409499177†L92-L122】.',
        'Switzer went on to run more than 40 marathons and won the New York City Marathon in 1974【935647409499177†L129-L152】.',
        'She helped get the women’s marathon added to the Olympics and founded the global nonprofit 261 Fearless to empower women through running【935647409499177†L129-L152】.'
      ]
    }
  ];

  // Guided runs definitions. Each run has a duration in minutes and a script of timed messages.
  guidedRuns = [
    {
      name: '20‑minute Easy Run',
      description: 'A relaxed run to loosen up and build endurance.',
      duration: 20,
      script: [
        { offset: 0, text: 'Welcome to your 20‑minute easy run. Start at a gentle pace and focus on your breathing.' },
        { offset: 5, text: 'Great work! Keep that easy rhythm. Remember, pain unlocks a secret doorway in your mind.' },
        { offset: 10, text: 'You are halfway through. Maintain your pace and enjoy the run.' },
        { offset: 15, text: 'Only five minutes left. Don’t stop when you’re tired. Stop when you’re done.' },
        { offset: 20, text: 'That’s it! Slow down and walk for a few minutes to cool down. You did it!' }
      ]
    },
    {
      name: '30‑minute Tempo Run',
      description: 'Includes a warm‑up, tempo section and cool‑down.',
      duration: 30,
      script: [
        { offset: 0, text: 'Start your 30‑minute tempo run with a 5‑minute easy warm‑up.' },
        { offset: 5, text: 'Time to pick up the pace into a comfortably hard tempo. Keep breathing steady.' },
        { offset: 15, text: 'Halfway through the tempo section. Stay strong and disciplined.' },
        { offset: 25, text: 'Ease back into an easy pace for the cool‑down.' },
        { offset: 30, text: 'Great job! You’ve completed your tempo run.' }
      ]
    },
    {
      name: '45‑minute Long Run',
      description: 'Longer run to build endurance and mental toughness.',
      duration: 45,
      script: [
        { offset: 0, text: 'Welcome to your long run. Start slowly and find a relaxed rhythm.' },
        { offset: 10, text: 'Keep it steady. You are in danger of living a life too comfortable; push your boundaries.' },
        { offset: 20, text: 'You’re doing great. The human body can accomplish far more than we think.' },
        { offset: 30, text: 'Only 15 minutes left. Build calluses on your mind by staying present.' },
        { offset: 40, text: 'Final five minutes. Dig deep and finish strong.' },
        { offset: 45, text: 'Well done! Slow down and cool down for a few minutes.' }
      ]
    }
  ];
}

/**
 * Set up navigation by listening for clicks on navigation buttons.
 */
function initNavigation() {
  const navButtons = document.querySelectorAll('#nav-bar .nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      showPage(target);
    });
  });
  // Buttons on the home page
  document.getElementById('start-run-btn').addEventListener('click', () => startRun());
  // Button to start today’s scheduled run as a guided workout. It uses the
  // training plan and generates a schedule of audio cues based on the workout type.
  document.getElementById('start-guided-today-btn').addEventListener('click', () => {
    const guided = getGuidedScheduleForToday();
    if (guided) {
      startRun(guided);
    } else {
      // Fallback to unguided run if no schedule could be generated
      startRun();
    }
  });
  document.getElementById('guided-run-btn').addEventListener('click', () => {
    showPage('guided-page');
  });
  document.getElementById('stop-run-btn').addEventListener('click', () => stopRun());
}

/**
 * Show a specific page and hide others.
 * @param {string} pageId
 */
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(sec => {
    if (sec.id === pageId) {
      sec.classList.add('active');
    } else {
      sec.classList.remove('active');
    }
  });
}

/**
 * Load stored runs from localStorage.
 */
function loadStoredRuns() {
  try {
    const data = localStorage.getItem('runcoach-runs');
    if (data) {
      runs = JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load runs', e);
  }
  updateLastRunSummary();
}

/**
 * Save runs to localStorage.
 */
function saveRuns() {
  localStorage.setItem('runcoach-runs', JSON.stringify(runs));
}

/**
 * Display summary of the most recent run on the home page.
 */
function updateLastRunSummary() {
  const summaryDiv = document.getElementById('last-run-summary');
  if (runs.length === 0) {
    summaryDiv.textContent = 'No runs recorded yet.';
    return;
  }
  const last = runs[runs.length - 1];
  summaryDiv.innerHTML = `<strong>Last run:</strong> ${last.distance.toFixed(2)} km in ${formatTime(last.duration)} (pace ${formatPace(last.duration / last.distance)}).`;
}

/**
 * Compute personal bests and render them.
 */
function renderRecords() {
  const container = document.getElementById('records-container');
  container.innerHTML = '';
  if (runs.length === 0) {
    container.textContent = 'No run data available to compute personal bests.';
    return;
  }
  // Determine best distances and best paces by day of week.
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // Best pace (min/km) per day
  const bestPaceByDay = {};
  // Longest distance per day
  const longestDistanceByDay = {};
  runs.forEach(run => {
    const date = new Date(run.date);
    const day = daysOfWeek[date.getDay()];
    const pace = run.duration / run.distance;
    if (!bestPaceByDay[day] || pace < bestPaceByDay[day].pace) {
      bestPaceByDay[day] = { pace, run };
    }
    if (!longestDistanceByDay[day] || run.distance > longestDistanceByDay[day].distance) {
      longestDistanceByDay[day] = { distance: run.distance, run };
    }
  });
  // Build HTML lists
  const paceList = document.createElement('div');
  paceList.innerHTML = '<h3>Best Pace by Day</h3>';
  for (const day of daysOfWeek) {
    if (bestPaceByDay[day]) {
      const r = bestPaceByDay[day].run;
      const pace = bestPaceByDay[day].pace;
      const div = document.createElement('div');
      div.textContent = `${day}: ${formatPace(pace)} /km over ${r.distance.toFixed(2)} km on ${new Date(r.date).toLocaleDateString()}`;
      paceList.appendChild(div);
    }
  }
  const distList = document.createElement('div');
  distList.innerHTML = '<h3>Longest Distance by Day</h3>';
  for (const day of daysOfWeek) {
    if (longestDistanceByDay[day]) {
      const r = longestDistanceByDay[day].run;
      const div = document.createElement('div');
      div.textContent = `${day}: ${r.distance.toFixed(2)} km in ${formatTime(r.duration)} on ${new Date(r.date).toLocaleDateString()}`;
      distList.appendChild(div);
    }
  }
  container.appendChild(paceList);
  container.appendChild(distList);
}

/**
 * Display the current day’s training plan.
 */
function renderTodayPlan() {
  const planDiv = document.getElementById('today-plan');
  // Determine current week number in training plan (0-7) based on runs completed.
  const completedRuns = runs.length;
  const currentWeek = Math.min(Math.floor(completedRuns / 5), trainingPlan.length - 1);
  const week = trainingPlan[currentWeek];
  // Determine index within week (0-4) as next run to perform
  const dayIndex = completedRuns % 5;
  const workout = week[dayIndex];
  planDiv.innerHTML = `<strong>Week ${currentWeek + 1}, Day ${dayIndex + 1}:</strong> ${workout.type} – ${workout.description}`;
}

/**
 * Render the full training plan as a table.
 */
function renderPlan() {
  const container = document.getElementById('plan-container');
  container.innerHTML = '';
  trainingPlan.forEach((week, index) => {
    const weekDiv = document.createElement('div');
    weekDiv.className = 'week';
    const title = document.createElement('h3');
    title.textContent = `Week ${index + 1}`;
    weekDiv.appendChild(title);
    week.forEach((day, dayIndex) => {
      const div = document.createElement('div');
      // Container for day description and action button
      const textSpan = document.createElement('span');
      textSpan.textContent = `Day ${dayIndex + 1}: ${day.type} – ${day.description}`;
      div.appendChild(textSpan);
      // Add a button to start this specific run guided
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.textContent = 'Start';
      btn.style.marginLeft = '8px';
      btn.addEventListener('click', () => {
        const guided = generateGuidedSchedule(day);
        startRun(guided);
      });
      div.appendChild(btn);
      weekDiv.appendChild(div);
    });
    container.appendChild(weekDiv);
  });
}

/**
 * Render the history of recorded runs with delete buttons. Each entry
 * shows the date, distance, duration and pace of the run. A delete
 * button allows the user to remove erroneous runs from localStorage.
 */
function renderHistory() {
  const container = document.getElementById('history-container');
  if (!container) return;
  container.innerHTML = '';
  if (runs.length === 0) {
    container.textContent = 'No runs recorded yet.';
    return;
  }
  runs.forEach((run, index) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const date = new Date(run.date).toLocaleDateString();
    const pace = run.distance > 0 ? formatPace(run.duration / run.distance) : '0:00';
    div.innerHTML = `<strong>${date}</strong> – ${run.distance.toFixed(2)} km in ${formatTime(run.duration)} (pace ${pace})`;
    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Delete';
    delBtn.style.marginLeft = '8px';
    delBtn.addEventListener('click', () => {
      deleteRun(index);
    });
    div.appendChild(delBtn);
    container.appendChild(div);
  });
}

/**
 * Delete a run by index from the runs array and persist the change. After
 * deletion the history, records and today’s plan are refreshed.
 * @param {number} index
 */
function deleteRun(index) {
  if (index < 0 || index >= runs.length) return;
  runs.splice(index, 1);
  saveRuns();
  renderHistory();
  renderRecords();
  renderTodayPlan();
  updateLastRunSummary();
}

/**
 * Render a daily motivational quote.
 */
function renderQuote() {
  const quoteEl = document.getElementById('daily-quote');
  // Use the day of year to pick a quote
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const quote = quotes[dayOfYear % quotes.length];
  quoteEl.textContent = quote;
}

/**
 * Convert seconds to HH:MM:SS format.
 * @param {number} sec
 */
function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const hh = h > 0 ? `${h}:` : '';
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return `${hh}${mm}:${ss}`;
}

/**
 * Format pace given seconds per kilometer.
 * @param {number} spk
 */
function formatPace(spk) {
  if (!isFinite(spk) || spk <= 0) return '0:00';
  const m = Math.floor(spk / 60);
  const s = Math.floor(spk % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Start a run session. If a guided run is selected, guidedSchedule is provided.
 */
function startRun(guided = null) {
  // Reset metrics
  runStartTime = Date.now();
  runDistance = 0;
  halfKmSegments = 0;
  lastPosition = null;
  // Clear any previous timers
  if (runTimer) clearInterval(runTimer);
  // Setup guided schedule if provided
  guidedSchedule = guided;
  // Show run page
  showPage('run-page');
  // Start duration timer
  runTimer = setInterval(updateRunMetrics, 1000);
  // Request location updates
  if (navigator.geolocation) {
    runWatchId = navigator.geolocation.watchPosition(onPositionUpdate, onPositionError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    });
  } else {
    alert('Geolocation is not supported by your browser');
  }
  // Schedule guided messages if applicable
  if (guidedSchedule) {
    scheduleGuidedMessages(guidedSchedule);
  }
}

/**
 * Internal: schedule messages for a guided run.
 */
function scheduleGuidedMessages(guided) {
  guided.script.forEach(item => {
    setTimeout(() => {
      speakMessage(item.text);
    }, item.offset * 60 * 1000);
  });
}

/**
 * Generate a guided run schedule for the current day’s workout based on the
 * training plan and number of completed runs. This function determines
 * which workout comes next and returns a guided schedule object with
 * duration and timed script messages. If no appropriate schedule can
 * be generated, it returns null and the caller can fall back to an
 * unguided run.
 */
function getGuidedScheduleForToday() {
  // Determine the current workout using the same logic as renderTodayPlan
  const completedRuns = runs.length;
  const weekIndex = Math.min(Math.floor(completedRuns / 5), trainingPlan.length - 1);
  const dayIndex = completedRuns % 5;
  const week = trainingPlan[weekIndex];
  const workout = week[dayIndex];
  if (!workout) return null;
  return generateGuidedSchedule(workout);
}

/**
 * Create a guided run schedule object from a workout definition. The
 * returned object has the same shape as entries in the guidedRuns array
 * (name, description, duration and script). Durations and scripts are
 * estimated based on the workout type and description. Distances are
 * converted to approximate time using a conservative pace (e.g. 6
 * minutes per kilometre for easy and long runs). Interval workouts
 * are broken down into warm‑up, interval and recovery segments.
 *
 * @param {{type: string, description: string}} workout
 * @returns {{name: string, description: string, duration: number, script: Array<{offset:number,text:string}>}}
 */
function generateGuidedSchedule(workout) {
  const type = workout.type;
  const desc = workout.description;
  let duration = 0;
  const script = [];

  // Helper to parse kilometres from description (e.g. "7 km long run")
  function parseKm(d) {
    const m = d.match(/(\d+(?:\.\d+)?)\s*km/i);
    return m ? parseFloat(m[1]) : null;
  }
  // Helper to parse minutes (e.g. "20 min tempo run")
  function parseMinutes(d) {
    const m = d.match(/(\d+)\s*min/i);
    return m ? parseInt(m[1], 10) : null;
  }

  if (type === 'Easy' || type === 'Long') {
    // Estimate duration based on distance at ~6 min per km
    const km = parseKm(desc);
    duration = km ? Math.max(10, Math.round(km * 6)) : 30;
    script.push({ offset: 0, text: `Start your ${type.toLowerCase()} run at a comfortable pace.` });
    script.push({ offset: Math.round(duration * 0.5), text: `Great job! You're halfway through your ${type.toLowerCase()} run.` });
    script.push({ offset: Math.round(duration * 0.75), text: `Only a quarter left. Stay strong and maintain your pace.` });
    script.push({ offset: duration, text: `You've completed your ${type.toLowerCase()} run. Cool down and stretch.` });
  } else if (type === 'Tempo') {
    // Extract tempo duration or default to 20 minutes
    const tempoMinutes = parseMinutes(desc) || 20;
    const warmup = 5;
    const cooldown = 5;
    duration = warmup + tempoMinutes + cooldown;
    script.push({ offset: 0, text: `Begin with a ${warmup}‑minute easy warm‑up.` });
    script.push({ offset: warmup, text: `Transition into a comfortably hard tempo pace for ${tempoMinutes} minutes.` });
    script.push({ offset: warmup + Math.floor(tempoMinutes / 2), text: `You're halfway through the tempo section. Keep your cadence steady.` });
    script.push({ offset: warmup + tempoMinutes, text: `Slow down into an easy pace for a ${cooldown}‑minute cool‑down.` });
    script.push({ offset: duration, text: `Great work! Tempo run complete.` });
  } else if (type === 'Intervals') {
    // Parse number of intervals from patterns like "4×400 m" or "5×800 m"
    let reps = 4;
    const m = desc.match(/(\d+)\s*[×x]\s*\d+/);
    if (m) {
      reps = parseInt(m[1], 10);
    }
    const high = 2;    // minutes of hard running per interval
    const rest = 1;    // minutes of recovery per interval
    const warmup = 5;
    const cooldown = 5;
    duration = warmup + reps * (high + rest) + cooldown;
    script.push({ offset: 0, text: `Begin with a ${warmup}‑minute warm‑up.` });
    let current = warmup;
    for (let i = 0; i < reps; i++) {
      script.push({ offset: current, text: `Interval ${i + 1}: push the pace for ${high} minutes.` });
      current += high;
      script.push({ offset: current, text: `Recovery: jog easily for ${rest} minute${rest > 1 ? 's' : ''}.` });
      current += rest;
    }
    script.push({ offset: warmup + reps * (high + rest), text: `Cool down for ${cooldown} minutes at an easy pace.` });
    script.push({ offset: duration, text: `Well done! You've finished your interval session.` });
  } else {
    // Fallback for unknown types: simple run with start and finish messages
    duration = 30;
    script.push({ offset: 0, text: `Start your ${type.toLowerCase()} run.` });
    script.push({ offset: 15, text: `You're halfway through.` });
    script.push({ offset: duration, text: `Run complete. Nice work!` });
  }
  // Insert additional motivational messages at approximately quarter, half and three‑quarter marks
  insertMotivationalMessages(script, duration);
  // Insert storytelling and advice messages for continuous guidance
  insertStoryMessages(script, duration);
  return { name: `${type} Guided Run`, description: desc, duration, script };
}

/**
 * Given an existing script and total duration (in minutes), insert
 * motivational messages at the 25%, 50% and 75% marks. If a script
 * already has a message scheduled within 1 minute of one of these
 * offsets, that offset is skipped. Messages are pulled sequentially
 * from the `quotes` array, cycling through if necessary.
 * @param {Array<{offset:number,text:string}>} script
 * @param {number} duration
 */
function insertMotivationalMessages(script, duration) {
  const existingOffsets = script.map(item => item.offset);
  const extraOffsets = [];
  [0.25, 0.5, 0.75].forEach(frac => {
    const off = Math.round(duration * frac);
    // Skip if there is already a message within one minute of this offset
    if (!existingOffsets.some(o => Math.abs(o - off) < 1)) {
      extraOffsets.push(off);
    }
  });
  // Pick starting quote index based on current day to avoid repetition across sessions
  let quoteIndex = new Date().getDay() % quotes.length;
  extraOffsets.forEach(off => {
    const text = quotes[quoteIndex % quotes.length];
    script.push({ offset: off, text });
    quoteIndex++;
  });
  // Ensure script is sorted by offset in ascending order
  script.sort((a, b) => a.offset - b.offset);
}

/**
 * Insert storytelling and running advice messages throughout a run. This
 * function selects one of the stories defined in the `stories` array based
 * on the number of completed runs (to provide variety). It then
 * distributes the story segments evenly across the run’s duration. If a
 * desired insertion offset would collide with an existing message (within
 * one minute), the function nudges the offset forward until a free slot
 * is found. Messages are truncated if the calculated offset would
 * exceed the total duration.
 *
 * @param {Array<{offset:number,text:string}>} script
 * @param {number} duration Total duration of the run in minutes
 */
function insertStoryMessages(script, duration) {
  if (!stories || stories.length === 0) return;
  // Pick a story set based on completed runs to rotate through stories
  const story = stories[(runs.length) % stories.length];
  const segments = story.segments;
  if (!segments || segments.length === 0) return;
  const existingOffsets = script.map(item => item.offset);
  // Determine spacing between story segments. Add one extra interval so
  // messages don’t cluster at the start or end.
  // Compute a base interval to spread segments evenly across the run. We
  // explicitly schedule the first story segment at 1 minute to ensure
  // guidance begins almost immediately after the run starts. The remaining
  // segments are spaced evenly over the rest of the duration.
  const baseInterval = duration / (segments.length + 1);
  let offset = 1;
  segments.forEach(segment => {
    // Avoid scheduling messages beyond the total duration
    if (offset >= duration) return;
    // Skip times that conflict with existing messages within one minute
    while (existingOffsets.some(o => Math.abs(o - offset) < 1) && offset < duration) {
      offset += 1;
    }
    if (offset < duration) {
      script.push({ offset: offset, text: segment });
      existingOffsets.push(offset);
      offset += baseInterval;
    }
  });
  script.sort((a, b) => a.offset - b.offset);
}

/**
 * Speak a message using the Web Speech API.
 * @param {string} text
 */
function speakMessage(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    // Lower volume slightly to duck underlying music
    utterance.volume = 1.0;
    speechSynthesis.speak(utterance);
  } else {
    console.log('Speech synthesis not supported');
  }
}

/**
 * Handler for geolocation updates.
 * @param {Position} position
 */
function onPositionUpdate(position) {
  const { latitude, longitude } = position.coords;
  if (lastPosition) {
    const dist = haversineDistance(lastPosition.lat, lastPosition.lon, latitude, longitude);
    runDistance += dist;
    // Check for half kilometre announcements
    if (runDistance >= (halfKmSegments + 1) * 0.5) {
      halfKmSegments++;
      const kmMark = (halfKmSegments * 0.5).toFixed(1);
      speakMessage(`${kmMark} kilometers completed`);
    }
  }
  lastPosition = { lat: latitude, lon: longitude };
}

/**
 * Handler for geolocation errors.
 */
function onPositionError(error) {
  console.warn('Geolocation error', error);
}

/**
 * Update metrics displayed during a run.
 */
function updateRunMetrics() {
  const now = Date.now();
  const elapsedSeconds = (now - runStartTime) / 1000;
  document.getElementById('metric-distance').textContent = runDistance.toFixed(2);
  document.getElementById('metric-duration').textContent = formatTime(elapsedSeconds);
  const pace = runDistance > 0 ? elapsedSeconds / runDistance : 0;
  document.getElementById('metric-pace').textContent = formatPace(pace);
  // If this is a guided run and we passed its duration, stop automatically
  if (guidedSchedule && elapsedSeconds / 60 >= guidedSchedule.duration) {
    stopRun();
  }
}

/**
 * Stop the current run session.
 */
function stopRun() {
  if (!runStartTime) return; // not running
  const elapsedSeconds = (Date.now() - runStartTime) / 1000;
  // Clear timers and geolocation
  if (runTimer) clearInterval(runTimer);
  runTimer = null;
  if (runWatchId !== null) {
    navigator.geolocation.clearWatch(runWatchId);
    runWatchId = null;
  }
  // Save run data
  const run = {
    date: new Date().toISOString(),
    distance: runDistance,
    duration: elapsedSeconds
  };
  runs.push(run);
  saveRuns();
  // Reset state
  runStartTime = null;
  runDistance = 0;
  lastPosition = null;
  guidedSchedule = null;
  // Show summary on home page
  showPage('home-page');
  updateLastRunSummary();
  renderRecords();
  renderTodayPlan();
  // Optionally upload to Strava if authorized
  if (stravaTokens && stravaTokens.access_token) {
    uploadToStrava(run);
  }
}

/**
 * Compute distance between two lat/lon pairs in kilometers using the Haversine formula.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => deg * (Math.PI / 180);
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Render guided runs list and set up selection.
 */
function renderGuidedList() {
  const listDiv = document.getElementById('guided-list');
  listDiv.innerHTML = '';
  guidedRuns.forEach((gr, index) => {
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = `${gr.name} – ${gr.description}`;
    btn.addEventListener('click', () => {
      // When starting a guided run, pass the guided configuration
      startRun(gr);
    });
    listDiv.appendChild(btn);
  });
}

// ===================== STRAVA INTEGRATION =====================
let stravaClientId = null;
let stravaClientSecret = null;
let stravaTokens = null;

/**
 * Initialize Strava integration by checking stored credentials and processing OAuth redirect.
 */
function initStrava() {
  // Load stored client ID/secret and tokens from localStorage
  const cid = localStorage.getItem('strava-client-id');
  const cs = localStorage.getItem('strava-client-secret');
  const tokens = localStorage.getItem('strava-tokens');
  if (cid) stravaClientId = cid;
  if (cs) stravaClientSecret = cs;
  if (tokens) stravaTokens = JSON.parse(tokens);
  // Process OAuth redirect
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const scope = params.get('scope');
  if (code && scope) {
    // Exchange code for access token
    exchangeStravaCode(code);
    // Remove query from URL
    history.replaceState({}, document.title, window.location.pathname);
  }
  // Add link to Strava status area for authorizing or disconnecting
  const statusDiv = document.getElementById('strava-status');
  statusDiv.innerHTML = '';
  const inputCid = document.createElement('input');
  inputCid.placeholder = 'Strava Client ID';
  inputCid.value = stravaClientId || '';
  inputCid.addEventListener('change', () => {
    stravaClientId = inputCid.value;
    localStorage.setItem('strava-client-id', stravaClientId);
  });
  const inputCs = document.createElement('input');
  inputCs.placeholder = 'Strava Client Secret';
  inputCs.value = stravaClientSecret || '';
  inputCs.addEventListener('change', () => {
    stravaClientSecret = inputCs.value;
    localStorage.setItem('strava-client-secret', stravaClientSecret);
  });
  inputCid.style.marginRight = '0.5rem';
  inputCs.style.marginRight = '0.5rem';
  statusDiv.appendChild(inputCid);
  statusDiv.appendChild(inputCs);
  const btn = document.createElement('button');
  btn.className = 'secondary';
  btn.textContent = stravaTokens ? 'Disconnect Strava' : 'Connect Strava';
  btn.addEventListener('click', () => {
    if (stravaTokens) {
      // Disconnect
      stravaTokens = null;
      localStorage.removeItem('strava-tokens');
      btn.textContent = 'Connect Strava';
    } else {
      authorizeWithStrava();
    }
  });
  statusDiv.appendChild(btn);
}

/**
 * Display Strava connection status on the home page.
 */
function displayStravaStatus() {
  const statusDiv = document.getElementById('strava-status');
  const statusText = document.createElement('div');
  if (stravaTokens) {
    statusText.textContent = 'Connected to Strava';
  } else {
    statusText.textContent = 'Not connected to Strava';
  }
  statusDiv.appendChild(statusText);
}

/**
 * Start the OAuth authorization flow with Strava. The user must have provided client ID and secret.
 */
function authorizeWithStrava() {
  if (!stravaClientId) {
    alert('Please enter your Strava Client ID and Secret first.');
    return;
  }
  // Strava requires a redirect URI registered in the developer settings. For a local PWA, instruct users
  // to set the redirect URI to the app’s URL (e.g. http://localhost or your deployed URL).
  const redirectUri = window.location.origin + window.location.pathname;
  const scope = 'activity:write';
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(stravaClientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&approval_prompt=auto&scope=${encodeURIComponent(scope)}`;
  window.location.href = authUrl;
}

/**
 * Exchange the authorization code for an access token using the stored client secret.
 * @param {string} code
 */
function exchangeStravaCode(code) {
  if (!stravaClientId || !stravaClientSecret) {
    alert('Missing Strava client credentials.');
    return;
  }
  const body = new URLSearchParams();
  body.set('client_id', stravaClientId);
  body.set('client_secret', stravaClientSecret);
  body.set('code', code);
  body.set('grant_type', 'authorization_code');
  fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
    .then(res => res.json())
    .then(data => {
      if (data.access_token) {
        stravaTokens = data;
        localStorage.setItem('strava-tokens', JSON.stringify(stravaTokens));
        alert('Strava connected successfully.');
        displayStravaStatus();
      } else {
        console.error('Failed to exchange token', data);
      }
    })
    .catch(err => console.error('Token exchange error', err));
}

/**
 * Upload a completed run to Strava.
 * @param {Object} run
 */
function uploadToStrava(run) {
  if (!stravaTokens || !stravaTokens.access_token) return;
  // Refresh token if necessary
  const now = Math.floor(Date.now() / 1000);
  if (stravaTokens.expires_at && stravaTokens.expires_at < now) {
    refreshStravaToken().then(() => {
      uploadToStrava(run);
    });
    return;
  }
  const url = 'https://www.strava.com/api/v3/activities';
  const body = {
    name: 'Run with RunCoach',
    type: 'Run',
    sport_type: 'Run',
    start_date_local: run.date,
    elapsed_time: Math.round(run.duration),
    distance: Math.round(run.distance * 1000),
    description: 'Synced from RunCoach PWA'
  };
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + stravaTokens.access_token
    },
    body: JSON.stringify(body)
  })
    .then(res => res.json())
    .then(data => {
      if (data && data.id) {
        console.log('Run uploaded to Strava', data.id);
      } else {
        console.error('Strava upload error', data);
      }
    })
    .catch(err => console.error('Strava upload failed', err));
}

/**
 * Refresh an expired Strava token.
 */
function refreshStravaToken() {
  return new Promise((resolve, reject) => {
    if (!stravaTokens || !stravaTokens.refresh_token) {
      reject('No refresh token');
      return;
    }
    const body = new URLSearchParams();
    body.set('client_id', stravaClientId);
    body.set('client_secret', stravaClientSecret);
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', stravaTokens.refresh_token);
    fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    })
      .then(res => res.json())
      .then(data => {
        if (data.access_token) {
          stravaTokens = data;
          localStorage.setItem('strava-tokens', JSON.stringify(stravaTokens));
          resolve();
        } else {
          console.error('Strava token refresh failed', data);
          reject(data);
        }
      })
      .catch(err => {
        console.error('Strava refresh error', err);
        reject(err);
      });
  });
}