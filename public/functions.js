// Firebase configurations
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const statusRef = db.ref("door-status");
const objectRef = db.ref("obj_obstruction");
const servoRef = db.ref("servo-move");

// Update UI with door status
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

// Update button text and click behavior
function updateButtonUI(status) {
  const btn = document.getElementById("doorToggleBtn");
  if (!btn) return;

  if (status === 1) {
    btn.textContent = "Close Door";
    btn.onclick = () => {
      objectRef.once("value")
        .then(snapshot => {
          const objectDetected = snapshot.val();
          if (objectDetected === 0) {
            statusRef.set(0).then(() => {
              moveServo(); // Trigger servo after closing
            });
          } else {
            alert("⚠ Cannot close door: Object detected! View live feed for more info");
          }
        })
        .catch(error => {
          console.error("Object check error:", error);
          alert("Error checking for obstacles.");
        });
    };
  } else {
    btn.textContent = "Open Door";
    btn.onclick = () => {
      statusRef.set(1).then(() => {
        moveServo(); // Trigger servo after opening
      });
    };
  }
}

function moveServo() {
  servoRef.set(1)
    .then(() => {
      setTimeout(() => {
        servoRef.set(0);
      }, 750);
    })
    .catch(error => {
      console.error("Error triggering servo:", error);
    });
}

function viewLiveFeed() {
  window.location.href = "https://esp32-object-detection-d863a.web.app";
}

// Realtime status listener
statusRef.on("value", (snapshot) => {
  const status = snapshot.val();
  if (status !== null) {
    updateStatusUI(status);
  } else {
    console.log("No status found");
  }
});

document.addEventListener("DOMContentLoaded", () => {
});
