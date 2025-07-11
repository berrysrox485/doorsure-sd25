/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onValueWritten } = require("firebase-functions/v2/database");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

admin.initializeApp();

// You should set the SendGrid key as an environment variable or use functions config like before.

exports.sendGarageStatusNotifications = onValueWritten("/door-status", async (event) => {
    const sgKey = process.env.SENDGRID_API_KEY;
  sgMail.setApiKey(sgKey);
  console.log("🔑 API key starts with:", sgKey?.substring(0, 5));

  const before = event.data?.before?.val();
  const after = event.data?.after?.val();

  // if no change, do nothing
  if (before === after) return null;

  const isOpen = after === 1;
  const eventType = isOpen ? "notifyGarageOpen" : "notifyGarageClose";
  const subject = isOpen ? "DoorSure Alert 🔓 Garage Opened" : "DoorSure Alert 🔒 Garage Closed";

  try {
    const usersSnap = await admin.database().ref("/users").once("value");
    const users = usersSnap.val();

    if (!users) return null;    // no one to notify

    const emailsToNotify = [];

    for (const uid in users) {
      const user = users[uid];
      const prefs = user.preferences || {};
      const email = user.email;
      const username = user.username || "User"; //personalize  eail w username

      if (prefs[eventType] && email) {
        const text = isOpen
          ? `Hello ${username}, the garage door was opened.`
          : `Hello ${username}, the garage door was closed.`;

        const html = `<strong>${text}</strong><br><br>— DoorSure System`;
        emailsToNotify.push({
          to: email,
          from: "an389350@ucf.edu", // verified email on SendGrid
          subject,
          text,
          html,
        });
      }
    }

    if (emailsToNotify.length === 0) {
      console.log("📭 No users to notify for this event.");
      return null;
    }

    // Send emails
    for (const msg of emailsToNotify) {
      await sgMail.send(msg);
      console.log(`✅ Email sent to ${msg.to}`);
    }

  } catch (err) {
    console.error("❌ Error sending notifications:", err);
  }
  return null;
});
