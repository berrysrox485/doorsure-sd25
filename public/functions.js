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

// Reference to update UI with current status
const statusRef = db.ref('door-status');

// Function to update the UI with the current status
function updateStatusUI(value) {
  document.getElementById("curr_status").textContent = value === 1 ? "Open" : "Closed";
}

// User hits open button
function openAction() {
  statusRef.set(1);
}

// User hits close button
function closeAction() {
  statusRef.set(0);
}

// WebSocket connection setup, with ESP32's IP ADDRESS
const socket = new WebSocket('ws://192.168.4.96/ws'); // servos IP ADDRESS, change later to grab it from the esp32
socket.onopen = () => {
  console.log('WebSocket connection established');
};
socket.onerror = (error) => {
  console.error('WebSocket error:', error);
};
socket.onmessage = (event) => {
  console.log('Message from ESP32:', event.data);
};

// Real-time listener for the status
statusRef.on('value', (snapshot) => {
  const status = snapshot.val();
  if (status !== null) {
    updateStatusUI(status);
    
    // Send signal to ESP32
    if (socket.readyState === WebSocket.OPEN) {
      console.log('Sending status to ESP32:', status === 1 ? 'open' : 'close');
      socket.send(status === 1 ? 'open' : 'close');
    } else {
      console.log('WebSocket is not open');
    }
  } else {
    console.log("No status data found!");
  }
});