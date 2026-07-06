const cron = require("node-cron");
const { getState, resetDaily, morningWasSentToday, setMorningMessageSent, hasBeenInactiveFor1Hour } = require("./storage");
const { generateMorningMessage, formatTaskList } = require("./coach");

function startScheduler(lineClient) {
  // 毎朝5時（月〜土）：タスク配信
  cron.schedule("0 5 * * 1-6", async () => {
    const { userId, doneTasks, doneWeeklyTasks } = getState();
    if (!userId) return;
    try {
      const msg = await generateMorningMessage(doneTasks, doneWeeklyTasks);
      await lineClient.pushMessage(userId, { type: "text", text: msg });
      setMorningMessageSent();
      console.log("Morning message sent");
    } catch (e) { console.error("Morning error:", e.message); }
  }, { timezone: "Asia/Tokyo" });

  // 6〜17時：1時間活動なければタスクリストを送る
  cron.schedule("0 6-17 * * *", async () => {
    const { userId, doneTasks, doneWeeklyTasks } = getState();
    if (!userId) return;
    if (!hasBeenInactiveFor1Hour()) return;
    try {
      const taskList = formatTaskList(doneTasks, doneWeeklyTasks);
      const msg = "1時間経ったね👀タスクどう？👇\n\n" + taskList;
      await lineClient.pushMessage(userId, { type: "text", text: msg });
      console.log("Inactivity task list sent");
    } catch (e) { console.error("Inactivity nudge error:", e.message); }
  }, { timezone: "Asia/Tokyo" });

  // 毎日0時：日次リセット
  cron.schedule("0 0 * * *", () => { resetDaily(); console.log("Daily reset"); }, { timezone: "Asia/Tokyo" });

  console.log("Scheduler started: 5am Mon-Sat, inactivity check 6-17 daily");
}

module.exports = { startScheduler };
