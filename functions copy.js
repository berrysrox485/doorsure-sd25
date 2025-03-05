// firebase congirations
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

// initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// reference to update ui with current status
const statusRef = db.ref('door-status');

// function pushes update to status
function updateStatusUI(value) {
  document.getElementById("curr_status").textContent = value === 1 ? "Open" : "Closed";
}

// user hits open button
function openAction() {
  statusRef.set(1);
}


// user hits close button
function closeAction() {
  statusRef.set(0);
}

// Real-time listener for the status
statusRef.on('value', (snapshot) => {
  const status = snapshot.val();
  if (status !== null) {
    updateStatusUI(status);
  } else {
    console.log("No status data found!");
  }
});