/* -------------- Firebase configurations -------------- */
const firebaseConfig = {
  apiKey: "AIzaSyCB_Gz5ADmjLxxxBYZ0OS7k_C03Wo42xFY",
  authDomain: "doorsure-sd25.firebaseapp.com",
  databaseURL: "https://doorsure-sd25-default-rtdb.firebaseio.com/",
  projectId: "doorsure-sd25",
  storageBucket: "doorsure-sd25.firebasestorage.app",
  messagingSenderId: "417711210584",
  appId: "1:417711210584:web:cec2421dafb4a19f008a2d",
  measurementId: "G-ZWNQT99F1Y",
};

const secondFirebaseConfig = {
  apiKey: "AIzaSyCjCXahhzsjSH1dmB5F0GGgw6TNTjpwudg",
  authDomain: "esp32-object-detection-d863a.firebaseapp.com",
  databaseURL: "https://esp32-object-detection-d863a-default-rtdb.firebaseio.com/",
  projectId: "esp32-object-detection-d863a",
  storageBucket: "esp32-object-detection-d863a.appspot.com",
  messagingSenderId: "572491364622",
  appId: "1:572491364622:web:5f916612bb18a61a09bf5f",
  measurementId: "G-F6PY8JMBJB"
};

/* -------------- Initialise Firebase apps -------------- */
firebase.initializeApp(firebaseConfig);
const db        = firebase.database();
const statusRef = db.ref("door-status");
const objectRef = db.ref("obj_obstruction");
const servoRef  = db.ref("servo-move");

const secondApp = firebase.initializeApp(secondFirebaseConfig, "secondApp");
const secondDb  = secondApp.database();

/* -------------- Toast helper -------------------------- */
function showToast(msg, type = "info", ms = 4000) {
  const note = document.getElementById("notification");
  note.textContent = msg;
  note.className = `notification ${type} show`;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => note.classList.remove("show"), ms);
}

/* -------------- UI helpers ---------------------------- */
function updateStatusUI(status) {
  const statusDiv = document.getElementById("curr_status");
  statusDiv.textContent = status === 1 ? "Open" : "Closed";

  if (status === 1) {
    statusDiv.classList.remove("closed-status");
    statusDiv.classList.add("open-status");
  } else {
    statusDiv.classList.remove("open-status");
    statusDiv.classList.add("closed-status");
  }
  updateButtonUI(status);
}

function updateButtonUI(status) {
  const btn = document.getElementById("doorToggleBtn");
  if (!btn) return;

  if (status === 1) {
    btn.textContent = "Close Door";
    btn.onclick = () => {
      objectRef.once("value")
        .then(snap => {
          const objDetected = snap.val();
          if (objDetected === 0) {
            toggleDoor(0);
          } else {
            showToast("⚠ Cannot close door: Object detected!", "error");
          }
        })
        .catch(err => {
          console.error("Object check error:", err);
          showToast("Error checking for obstacles.", "error");
        });
    };
  } else {
    btn.textContent = "Open Door";
    btn.onclick = () => toggleDoor(1);
  }
}

/* -------------- Door control & polling ---------------- */
function toggleDoor(targetStatus) {
  const btn = document.getElementById("doorToggleBtn");
  btn.disabled = true;
  btn.textContent = targetStatus === 1 ? "Opening…" : "Closing…";

  moveServo();

  const pollInt = 500, timeout = 15000;
  let elapsed = 0;
  const poll = setInterval(() => {
    statusRef.once("value")
      .then(snap => {
        const current = snap.val();
        if (current === targetStatus) {
          clearInterval(poll);
          btn.disabled = false;
          updateStatusUI(current);
        } else {
          elapsed += pollInt;
          if (elapsed >= timeout) {
            clearInterval(poll);
            btn.disabled = false;
            showToast("⏳ Door status update timed out – please try again.", "error");
            updateStatusUI(current);
          }
        }
      });
  }, pollInt);
}

function moveServo() {
  servoRef.set(1)
    .then(() => setTimeout(() => servoRef.set(0), 750))
    .catch(err => {
      console.error("Error triggering servo:", err);
      showToast("❌ Could not trigger servo.", "error");
    });
}

function viewLiveFeed() {
  window.location.href = "https://video-stream-bafda.web.app/";
}

/* -------------- Realtime listeners -------------------- */
statusRef.on("value", snap => {
  const st = snap.val();
  if (st !== null) updateStatusUI(st);
});

db.ref("/temperature").on("value", s => {
  const v = s.val();
  if (v !== null) document.getElementById("tempValue").textContent = v.toFixed(1);
});

db.ref("/humidity").on("value", s => {
  const v = s.val();
  if (v !== null) document.getElementById("humidityValue").textContent = v.toFixed(1);
});

/* 🔁 Sync door-status from second Firebase */
secondDb.ref("door-status").on("value", snap => {
  const newStatus = snap.val();
  if (newStatus !== null) {
    statusRef.once("value").then(primarySnap => {
      const currentStatus = primarySnap.val();
      if (currentStatus !== newStatus) {
        statusRef.set(newStatus)
          .then(() => console.log("✅ Synced door-status to primary Firebase"))
          .catch(err => console.error("❌ Failed to sync door-status:", err));
      }
    });
  }
});

/* 📏 Obstruction logic: ultrasonic/distance_inch vs g_length */
secondDb.ref("ultrasonic/distance_inch").on("value", snap => {
  const distanceStr = snap.val();
  const distance = parseFloat(distanceStr);

  if (isNaN(distance)) {
    console.warn("🚫 Invalid distance value received:", distanceStr);
    return;
  }

  db.ref("/g_length").once("value")
    .then(gSnap => {
      const gLength = parseFloat(gSnap.val());

      if (isNaN(gLength)) {
        console.warn("🚫 Invalid g_length value in DB:", gSnap.val());
        return;
      }

      const obstruction = (gLength - distance) >= 10 ? 1 : 0;

      db.ref("/obj_obstruction").set(obstruction)
        .then(() => {
          console.log(`📏 distance: ${distance}, g_length: ${gLength} → obstruction: ${obstruction}`);
        })
        .catch(err => {
          console.error("❌ Failed to update obj_obstruction:", err);
        });
    })
    .catch(err => {
      console.error("❌ Failed to read g_length:", err);
    });
});


/* -------------- Settings modal ------------------------ */
const modal = document.getElementById("settingsModal");
const overlay = document.getElementById("overlay");
const settingsIcon = document.getElementById("settingsIcon");
const gLengthInput = document.getElementById("gLengthInput");

settingsIcon.addEventListener("click", () => {
  modal.style.display = "block";
  overlay.style.display = "block";
  db.ref("/g_length").once("value")
    .then(s => {
      const v = s.val();
      if (v !== null) gLengthInput.value = v;
    });
});

function closeSettings() {
  modal.style.display = "none";
  overlay.style.display = "none";
}

function saveGLength() {
  const val = parseFloat(gLengthInput.value);
  if (isNaN(val)) {
    showToast("Please enter a valid number for g_length.", "error");
    return;
  }

  db.ref("/g_length").set(val)
    .then(() => secondDb.ref("/g_length").set(val))
    .then(() => showToast("✔ Settings updated successfully!", "success"))
    .catch(err => {
      console.error("Error saving:", err);
      showToast("❌ " + err.message, "error");
    });
}
