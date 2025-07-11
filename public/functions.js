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

const auth = firebase.auth();
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)  // makes sure user stays logged in
  .then(() => {
    // You can proceed with auth-related logic if needed
    console.log("🔐 Firebase auth persistence set to LOCAL");
  })
  .catch((error) => {
    console.error("❌ Failed to set auth persistence:", error);
  });

/* -------------- Toast helper -------------------------- */
function showToast(msg, type = "info", ms = 4000) {
  const note = document.getElementById("notification");
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
      window.location.href = "index.html";  // back to login page
    })
    .catch(error => {
      console.error("Logout failed:", error);
      showToast("Logout failed: " + error.message, "error");
    });
}


// makes sure user is authenticated before accessing the page
function requireAuth(redirectPath = "login.html", onAuthenticated = () => {}) {
  const timeout = setTimeout(() => {
    console.warn("⏳ Auth check timed out – redirecting.");
    window.location.href = redirectPath;
  }, 3000); // give Firebase up to 3 seconds to initialize

  firebase.auth().onAuthStateChanged(user => {
    clearTimeout(timeout);
    if (!user) {
      window.location.href = redirectPath;
    } else {
      onAuthenticated(user);
    }
  });
}

// UI update for status display
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

// UI update for the door toggle button
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

  moveServo();  // trigger the servo to move, add 1 or 2 based on pattern we want

  const pollInt = 500, timeout = 20000; // wait 20secs for timeout
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

// open live feed in a new tab
window.viewLiveFeed = function() {
  window.open("https://esp32-object-detection-d863a.web.app/", "_blank");
};



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
  const val = parseFloat(document.getElementById("gLengthInput").value);
  if (isNaN(val) || val < 0) {
    showToast("Please enter a valid non-negative number for garage length.", "error");
    return;
  }

  db.ref("/g_length").set(val)
    .then(() => secondDb.ref("/g_length").set(val))
    .then(() => {
      showToast("✔ Settings updated successfully!", "success");
      setTimeout(() => {
        location.reload();
      }, 1500);  // slight delay to let user see toast
    })
    .catch(err => {
      console.error("Error saving:", err);
      showToast("❌ " + err.message, "error");
    });
}

// notifications preferences and event listeners
// OPEN NOTIFICATIONS
const user = firebase.auth().currentUser;
firebase.database().ref(`/users/${user.uid}/preferences/notifyGarageOpen`).once("value")
  .then(snap => {
    document.getElementById("notifyGarageOpen").checked = !!snap.val();
  });

document.getElementById("notifyGarageOpen").addEventListener("change", (e) => {
  const enabled = e.target.checked;
  const user = firebase.auth().currentUser;
  firebase.database().ref(`/users/${user.uid}/preferences/notifyGarageOpen`).set(enabled);
});
