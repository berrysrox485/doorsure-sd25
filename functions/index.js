const { onValueWritten } = require("firebase-functions/v2/database");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

admin.initializeApp();

// Define and inject SendGrid secret
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");

// ─────────────────────────────────────────────────────────────
// 🚪 sendGarageStatusNotifications – Triggers when door opens/closes
// ─────────────────────────────────────────────────────────────
exports.sendGarageStatusNotifications = onValueWritten(
  {
    ref: "/door-status",
    secrets: [SENDGRID_API_KEY],
  },
  async (event) => {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const before = event.data?.before?.val();
    const after = event.data?.after?.val();
    if (before === after) return null;

    const isOpen = after === 1;
    const eventType = isOpen ? "notifyGarageOpen" : "notifyGarageClose";
    const subject = isOpen ? "DoorSure Alert 🔓 Garage Opened" : "DoorSure Alert 🔒 Garage Closed";

    try {
      const usersSnap = await admin.database().ref("/users").once("value");
      const users = usersSnap.val();
      if (!users) return null;

      const emailsToNotify = [];

      for (const uid in users) {
        const user = users[uid];
        const prefs = user.preferences || {};
        const email = user.email;
        const username = user.username || "User";

        if (prefs[eventType] && email) {
          const text = isOpen
            ? `Hello ${username}, the garage door was opened.`
            : `Hello ${username}, the garage door was closed.`;

          const html = `<strong>${text}</strong><br><br>— DoorSure System`;

          emailsToNotify.push({
            to: email,
            from: "an389350@ucf.edu", // SendGrid verified sender
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

      for (const msg of emailsToNotify) {
        await sgMail.send(msg);
        console.log(`✅ Email sent to ${msg.to}`);
      }
    } catch (err) {
      console.error("❌ Error sending notifications:", err);
    }

    return null;
  }
);

// ─────────────────────────────────────────────────────────────
// 🕒 sendOpenTooLongAlerts – Triggers on door open, checks timeout
// ─────────────────────────────────────────────────────────────
exports.sendOpenTooLongAlerts = onValueWritten(
  {
    ref: "/door-status",
    secrets: [SENDGRID_API_KEY],
  },
  async (event) => {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const before = event.data?.before?.val();
    const after = event.data?.after?.val();

    if (before === after || after !== 1) return null;

    try {
      const usersSnap = await admin.database().ref("/users").once("value");
      const users = usersSnap.val();

      for (const uid in users) {
        const user = users[uid];
        const prefs = user.preferences || {};
        const email = user.email;
        const username = user.username || "User";

        const timeoutMin = parseFloat(prefs.notifyOpenTimeout);
        if (!email || !timeoutMin || timeoutMin <= 0) continue;

        const delayMs = timeoutMin * 60 * 1000;

        // Simulate delayed task – NOTE: this may not run reliably on Cloud Functions
        setTimeout(async () => {
          try {
            const latestStatusSnap = await admin.database().ref("/door-status").once("value");
            const currentStatus = latestStatusSnap.val();

            if (currentStatus === 1) {
              const text = `Hello ${username}, your garage door has been open for more than ${timeoutMin} minute(s).`;
              const html = `<strong>${text}</strong><br><br>— DoorSure System`;

              const msg = {
                to: email,
                from: "an389350@ucf.edu",
                subject: "🚨 DoorSure Alert: Garage Open Too Long",
                text,
                html,
              };

              await sgMail.send(msg);
              console.log(`⏰ Delayed email sent to ${email}`);
            } else {
              console.log(`🟢 Garage closed before timeout for ${email}`);
            }
          } catch (delayErr) {
            console.error(`❌ Error in delayed check for ${email}:`, delayErr);
          }
        }, delayMs);
      }
    } catch (err) {
      console.error("❌ Error in delayed notifications:", err);
    }

    return null;
  }
);
