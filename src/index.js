require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const { getState, setUserId, markTaskDone, markWeeklyTaskDone, updateActivity, resetDaily, getTodayTasks, getHabitTasks, getWeeklyTasks, setTodayTasks, setHabitTasks, setWeeklyTasks, morningWasSentToday, setMorningMessageSent, restoreTasksFromBackup } = require("./storage");
const { generateReply, formatTaskList, generateMorningMessage } = require("./coach");
const { startScheduler } = require("./scheduler");

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new line.Client(lineConfig);
const app = express();

// Webhook
app.post("/webhook", line.middleware(lineConfig), async (req, res) => {
  try { await Promise.all(req.body.events.map(handleEvent)); res.json({ status: "ok" }); }
  catch (err) { console.error(err); res.status(500).end(); }
});

// Keep-alive
app.get("/ping", (req, res) => res.send("OK"));
app.get("/", (req, res) => res.send("Akiko LINE Coach running"));

// 朝メッセージ用エンドポイント（cron-job.orgから叩く）
app.get("/morning", async (req, res) => {
  res.send("OK");
  try {
    const { userId, doneTasks, doneWeeklyTasks } = getState();
    if (!userId) { console.log("morning: userIdなし"); return; }
    if (morningWasSentToday()) { console.log("morning: 今日は送信済み"); return; }
    const msg = await generateMorningMessage(doneTasks, doneWeeklyTasks);
    await lineClient.pushMessage(userId, { type: "text", text: msg });
    setMorningMessageSent();
    console.log("朝メッセージ送信完了");
  } catch (e) { console.error("朝メッセージエラー:", e.message); }
});

// 日次リセット用エンドポイント（cron-job.orgから叩く）
app.get("/reset", (req, res) => {
  resetDaily();
  console.log("日次リセット完了");
  res.send("OK");
});

async function sendReply(replyToken, userId, text) {
  try {
    await lineClient.replyMessage(replyToken, { type: "text", text });
  } catch (e) {
    console.log("replyMessage失敗、pushMessageで再送:", e.message);
    if (userId) await lineClient.pushMessage(userId, { type: "text", text });
  }
}

function parseTaskCommand(text) {
  const lines = text.split("\n").slice(1).filter(l => l.includes(":") || l.includes("："));
  if (lines.length === 0) return null;
  const tasks = {};
  for (const l of lines) {
    const normalized = l.replace(/：/g, ":");
    const idx = normalized.indexOf(":");
    const cat = normalized.slice(0, idx).trim();
    const items = normalized.slice(idx + 1).split(/[,、]/).map(t => t.trim()).filter(Boolean);
    if (cat && items.length > 0) tasks[cat] = items;
  }
  return Object.keys(tasks).length > 0 ? tasks : null;
}

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;
  const userId = event.source.userId;
  const text = event.message.text.trim();
  setUserId(userId);
  updateActivity();

  let replyText;

  if (text === "タスク" || text === "今日のタスク") {
    const s = getState();
    replyText = formatTaskList(s.doneTasks, s.doneWeeklyTasks);
  } else if (text.startsWith("今日のタスク設定")) {
    const parsed = parseTaskCommand(text);
    if (!parsed) {
      replyText = "形式はこれで送って！\n\n今日のタスク設定\nカテゴリ名: タスク1, タスク2";
    } else {
      setTodayTasks(parsed);
      resetDaily();
      replyText = "今日のタスク更新した！\n\n" + formatTaskList([], getState().doneWeeklyTasks);
    }
  } else if (text.startsWith("週間タスク設定")) {
    const parsed = parseTaskCommand(text);
    if (!parsed) {
      replyText = "形式はこれで送って！\n\n週間タスク設定\nカテゴリ名: タスク1, タスク2";
    } else {
      setWeeklyTasks(parsed);
      replyText = "週間タスク更新した！\n\n" + formatTaskList(getState().doneTasks, []);
    }
  } else if (text.startsWith("習慣タスク設定")) {
    const parsed = parseTaskCommand(text);
    if (!parsed) {
      replyText = "形式はこれで送って！\n\n習慣タスク設定\nカテゴリ名: タスク1, タスク2";
    } else {
      setHabitTasks(parsed);
      replyText = "習慣タスク更新した！毎日届くよ。\n\n" + formatTaskList(getState().doneTasks, getState().doneWeeklyTasks);
    }
  } else {
    const { doneTasks, doneWeeklyTasks } = getState();
    replyText = await generateReply(text, doneTasks);
    if (/やった|完了|できた|終わった|終わらせた/.test(text)) {
      const todayAndHabit = { ...getTodayTasks(), ...getHabitTasks() };
      for (const list of Object.values(todayAndHabit)) {
        for (const task of list) {
          const kw = task.replace(/（.*?）/g, "").split(/[・、。\s]/);
          if (kw.some(k => k.length > 2 && text.includes(k))) markTaskDone(task);
        }
      }
      const weekly = getWeeklyTasks();
      for (const list of Object.values(weekly)) {
        for (const task of list) {
          const kw = task.replace(/（.*?）/g, "").split(/[・、。\s]/);
          if (kw.some(k => k.length > 2 && text.includes(k))) markWeeklyTaskDone(task);
        }
      }
    }
  }

  await sendReply(event.replyToken, userId, replyText);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server on port ${PORT}`);
  try {
    const backup = await restoreTasksFromBackup();
    if (backup) {
      if (backup.customTodayTasks && Object.keys(getTodayTasks()).length === 0) setTodayTasks(backup.customTodayTasks);
      if (backup.customHabitTasks && Object.keys(getHabitTasks()).length === 0) setHabitTasks(backup.customHabitTasks);
      if (backup.customWeeklyTasks && Object.keys(getWeeklyTasks()).length === 0) setWeeklyTasks(backup.customWeeklyTasks);
    }
  } catch (e) { console.error("タスク復元エラー:", e.message); }
  startScheduler(lineClient);
  console.log("起動完了");
});
