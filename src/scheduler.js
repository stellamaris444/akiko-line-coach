const cron = require("node-cron");
const { getState, resetDaily, morningWasSentToday, hasRespondedSinceMorning, setMorningMessageSent } = require("./storage");
const { generateMorningMessage, generateHourlyNudge } = require("./coach");

function startScheduler(lineClient) {
  // 毎朝5時（月〜土）：タスク配信
  cron.schedule("0 5 * * 1-6", async () => {
    const { userId, doneTasks } = getState();
    if (!userId) return;
    try {
      const msg = await generateMorningMessage(doneTasks);
      await lineClient.pushMessage(userId, { type: "text", text: msg });
      setMorningMessageSent();
      console.log("Morning message sent");
    } catch (e) { console.error("Morning error:", e.message); }
  }, { timezone: "Asia/Tokyo" });

  // 6〜15時（月〜土）：タスク配信後、1時間返信なければナッジ
  cron.schedule("0 6-15 * * 1-6", async () => {
    const { userId, doneTasks } = getState();
    if (!userId) return;
    if (!morningWasSentToday()) return; // 朝のメッセージ未送信ならスキップ
    if (hasRespondedSinceMorning()) return; // 返信済みならスキップ
    try {
      const msg = await generateHourlyNudge(doneTasks);
      await lineClient.pushMessage(userId, { type: "text", text: msg });
      console.log("Hourly nudge sent");
    } catch (e) { console.error("Hourly nudge error:", e.message); }
  }, { timezone: "Asia/Tokyo" });

  // 毎日0時：日次リセット
  cron.schedule("0 0 * * *", () => { resetDaily(); console.log("Daily reset"); }, { timezone: "Asia/Tokyo" });

  console.log("Scheduler started: 5am Mon-Sat, hourly nudge 6-15 Mon-Sat");
}

module.exports = { startScheduler };
