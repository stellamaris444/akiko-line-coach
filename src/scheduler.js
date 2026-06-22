const cron = require("node-cron");
const { getState, resetDaily, morningWasSentToday, hasRespondedSinceMorning, setMorningMessageSent } = require("./storage");
const { generateMorningMessage, generateHourlyNudge } = require("./coach");

function startScheduler(lineClient) {
  // 毎朝6時（月〜土）：タスク配信
  cron.schedule("0 6 * * 1-6", async () => {
    const { userId, doneTasks } = getState();
    if (!userId) return;
    try {
      const msg = await generateMorningMessage(doneTasks);
      await lineClient.pushMessage(userId, { type: "text", text: msg });
      setMorningMessageSent();
      console.log("Morning message sent");
    } catch (e) { console.error("Morning error:", e.message); }
  }, { timezone: "Asia/Tokyo" });

  // 7〜21時（月〜土）：返信がなければ毎時間チェック
  cron.schedule("0 7-21 * * 1-6", async () => {
    const { userId, doneTasks } = getState();
    if (!userId) return;
    if (!morningWasSentToday()) return; // 朝のメッセージが未送信なら何もしない
    if (hasRespondedSinceMorning()) return; // 返信済みならスキップ
    try {
      const msg = await generateHourlyNudge(doneTasks);
      await lineClient.pushMessage(userId, { type: "text", text: msg });
      console.log("Hourly nudge sent");
    } catch (e) { console.error("Hourly nudge error:", e.message); }
  }, { timezone: "Asia/Tokyo" });

  // 毎日0時：日次リセット
  cron.schedule("0 0 * * *", () => { resetDaily(); console.log("Daily reset"); }, { timezone: "Asia/Tokyo" });

  console.log("Scheduler started: 6am Mon-Sat, hourly nudge 7-21 Mon-Sat, no Sunday");
}

module.exports = { startScheduler };
