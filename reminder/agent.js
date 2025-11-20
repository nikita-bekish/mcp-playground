import fs from "fs";

const DB = "./reminders.json";

function loadDb() {
  if (!fs.existsSync(DB)) return [];
  return JSON.parse(fs.readFileSync(DB, "utf8"));
}

function saveDb(db) {
  fs.writeFileSync(DB, JSON.stringify(db, null, 2));
}

function checkReminders() {
  const now = Date.now();
  const db = loadDb();

  for (const r of db) {
    if (!r.done && new Date(r.remindAt).getTime() <= now) {
      console.log("⏰ REMINDER:", r.text);
      r.done = true;
    }
  }

  saveDb(db);
}

setInterval(checkReminders, 5000);

console.log("Reminder agent started (24/7)");
