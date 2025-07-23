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

// Initialize primary Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const statusRef = db.ref("door-status");
const objectRef = db.ref("obj_obstruction");
const servoRef = db.ref("servo-move");
const commandRef = db.ref("door-command");

// Initialize second Firebase
const secondApp = firebase.initializeApp(secondFirebaseConfig, "secondApp");
const secondDb = secondApp.database();

/* -------------- Auth persistence --------------------- */
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => console.log("🔐 Firebase auth persistence set to LOCAL"))
  .catch((error) => console.error("❌ Failed to set auth persistence:", error));

/* -------------- Toast helper -------------------------- */
function showToast(msg, type = "info", ms = 4000) {
  const note = document.getElementById("notification");
  if (!note) return; // Guard for missing notification element
  note.textContent = msg;
  note.className = `notification ${type} show`;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => note.classList.remove("show"), ms);
}

/* -------------- UI helpers ---------------------------- */
function readUsername() {
  const username = localStorage.getItem('username');
  const displayElement = document.getElementById('usernameDisplay');
  if (displayElement) {
    displayElement.innerText = username || "User";
  }
}

// LOGOUT
function logout() {
  auth.signOut()
    .then(() => {
      localStorage.removeItem("username");
      window.location.href = "index.html";
    })
    .catch(error => {
      console.error("Logout failed:", error);
      showToast("Logout failed: " + error.message, "error");
    });
}

function updateStatusUI(status) {
  const statusDiv = document.getElementById("curr_status");
  if (!statusDiv) return;
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
    console.log("🔘 Close button clicked");

    objectRef.once("value")
      .then(snap => {
        const objDetected = snap.val();
        console.log("📡 Firebase read - objectRef value:", objDetected);

        if (parseInt(objDetected) === 0) {
          console.log("✅ No object detected, sending door close command");
          toggleDoor(0);
        } else {
          console.warn("🚫 Object detected! Not closing door.");
          showToast("⚠ Cannot close door: Object detected!", "error"); // display error 
        }
      })
      .catch(err => {
        console.error("❌ Error reading objectRef:", err);
        showToast("Error checking for obstacles.", "error");  // system error when checking the flag
      });
  };
}
 else {
    btn.textContent = "Open Door";
    btn.onclick = () => toggleDoor(1);
  }
}

/* -------------- Door control -------------------------- */
function toggleDoor(targetStatus) {
  const btn = document.getElementById("doorToggleBtn");
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = targetStatus === 1 ? "Opening…" : "Closing…";

  commandRef.set(targetStatus)  // change door command var to targetStatus in Firebase
    .then(() => {
      console.log(`✅ Door command set to ${targetStatus}`);

      // wait 5 seconds before resetting command to -1
      setTimeout(() => {
        commandRef.set(-1)
          .then(() => console.log("🔁 door-command reset to -1"))
          .catch(err => console.warn("Failed to reset door-command:", err));
      }, 5000);

      // poll to make sure status is updated, else show error
      const pollInt = 500, timeout = 20000;
      let elapsed = 0;
      const poll = setInterval(() => {
        statusRef.once("value").then(snap => {
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
              showToast("⏳ Door status update timed out – try again.", "error");
              updateStatusUI(current);
            }
          }
        });
      }, pollInt);
    })
    .catch(err => {
      console.error("Error sending door command:", err);
      showToast("❌ Failed to send door command.", "error");
      btn.disabled = false;
    });
}

window.viewLiveFeed = function () {
  window.open("https://esp32-object-detection-d863a.web.app/", "_blank");
};

/* -------------- Settings Modal Elements (settings.html only) ------------------------ */
const modal = document.getElementById("settingsModal");
const overlay = document.getElementById("overlay");
const settingsIcon = document.getElementById("settingsIcon");
const gLengthInput = document.getElementById("gLengthInput");

if (settingsIcon && modal && overlay && gLengthInput) {
  settingsIcon.addEventListener("click", () => {
    modal.style.display = "block";
    overlay.style.display = "block";
    db.ref("/g_length").once("value").then(s => {
      const v = s.val();
      if (v !== null) gLengthInput.value = v;
    });
  });
}

function closeSettings() {
  if (modal && overlay) {
    modal.style.display = "none";
    overlay.style.display = "none";
  }
}

function saveGLength() {
  if (!gLengthInput) return;

  const val = parseFloat(gLengthInput.value);
  if (isNaN(val) || val < 0) {
    showToast("Please enter a valid non-negative number.", "error");
    return;
  }

  db.ref("/g_length").set(val)
    .then(() => secondDb.ref("/g_length").set(val))
    .then(() => {
      showToast("✔ Settings updated!", "success");
      setTimeout(() => location.reload(), 1500);
    })
    .catch(err => {
      console.error("Error saving:", err);
      showToast("❌ " + err.message, "error");
    });
}

/* -------------- AUTH-AWARE Logic ---------------------- */
firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    console.warn("⛔ Not logged in. Redirecting to login...");
    window.location.href = "index.html";
    return;
  }

  console.log("✅ Authenticated:", user.uid);
  readUsername();

  // Live status listener (primary)
  statusRef.on("value", snap => {
    const st = snap.val();
    if (st !== null) updateStatusUI(st);
  });

  // Temperature listener
  db.ref("/temperature").on("value", s => {
    const v = s.val();
    const tempEl = document.getElementById("tempValue");
    if (v !== null && tempEl) tempEl.textContent = v.toFixed(1);
  });

  // Humidity listener
  db.ref("/humidity").on("value", s => {
    const v = s.val();
    const humEl = document.getElementById("humidityValue");
    if (v !== null && humEl) humEl.textContent = v.toFixed(1);
  });

  // Sync door-status from second DB → primary DB
  secondDb.ref("door-status").on("value", snap => {
    const newStatus = snap.val();
    console.log("📥 Synced value from secondDb:", newStatus);

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

  // Object obstruction check
  secondDb.ref("ultrasonic/distance_inch").on("value", snap => {
    const distance = parseFloat(snap.val());
    if (isNaN(distance)) return;

    db.ref("/g_length").once("value").then(gSnap => {
      const gLength = parseFloat(gSnap.val());
      if (isNaN(gLength)) return;

      const obstruction = (gLength - distance) >= 3 ? 1 : 0; // 3 inches threshold
      db.ref("/obj_obstruction").set(obstruction)
        .then(() => console.log(`📏 Obstruction updated: ${obstruction}`))
        .catch(err => console.error("❌ Failed to update obj_obstruction:", err));
    });
  });

  // Notification preferences
  const prefRef = db.ref(`/users/${user.uid}/preferences/notifyGarageOpen`);
  prefRef.once("value").then(snap => {
    const checkbox = document.getElementById("notifyGarageOpen");
    if (checkbox) checkbox.checked = !!snap.val();
  });

  const notifyCheckbox = document.getElementById("notifyGarageOpen");
  if (notifyCheckbox) {
    notifyCheckbox.addEventListener("change", (e) => {
      const enabled = e.target.checked;
      prefRef.set(enabled);
    });
  }
});
