require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const { getState, setUserId, markTaskDone, updateActivity, resetDaily, getTodayTasks, getHabitTasks, setTodayTasks, setHabitTasks, morningWasSentToday, setMorningMessageSent, restoreTasksFromBackup } = require("./storage");
const { generateReply, formatTaskList, generateMorningMessage } = require("./coach");
const { startScheduler } = require("./scheduler");

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const lineClient = new line.Client(lineConfig);
const app = express();

app.post("/webhook", line.middleware(lineConfig), async (req, res) => {
  try { await Promise.all(req.body.events.map(handleEvent)); res.json({ status: "ok" }); }
  catch (err) { console.error(err); res.status(500).end(); }
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
  const lines = text.split("\n").slice(1).filter(l => l.includes(":"));
  if (lines.length === 0) return null;
  const tasks = {};
  for (const l of lines) {
    const idx = l.indexOf(":");
    const cat = l.slice(0, idx).trim();
    const items = l.slice(idx + 1).split(",").map(t => t.trim()).filter(Boolean);
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
    replyText = formatTaskList(getState().doneTasks);
  } else if (text.startsWith("今日のタスク設定")) {
    const parsed = parseTaskCommand(text);
    if (!parsed) {
      replyText = "形式はこれで送って！\n\n今日のタスク設定\nカテゴリ名: タスク1, タスク2";
    } else {
      setTodayTasks(parsed);
      resetDaily();
      replyText = "今日のタスク更新した！\n\n" + formatTaskList([]);
    }
  } else if (text.startsWith("習慣タスク設定")) {
    const parsed = parseTaskCommand(text);
    if (!parsed) {
      replyText = "形式はこれで送って！\n\n習慣タスク設定\nカテゴリ名: タスク1, タスク2";
    } else {
      setHabitTasks(parsed);
      replyText = "習慣タスク更新した！毎日届くよ。\n\n" + formatTaskList([]);
    }
  } else {
    const { doneTasks } = getState();
    replyText = await generateReply(text, doneTasks);
    if (/やった|完了|できた|終わった|終わらせた/.test(text)) {
      const allTasks = { ...getTodayTasks(), ...getHabitTasks() };
      for (const list of Object.values(allTasks)) {
        for (const task of list) {
          const kw = task.replace(/（.*?）/g, "").split(/[・、。\s]/);
          if (kw.some(k => k.length > 2 && text.includes(k))) markTaskDone(task);
        }
      }
    }
  }

  await sendReply(event.replyToken, userId, replyText);
}

app.get("/ping", (req, res) => res.send("OK"));
app.get("/", (req, res) => res.send("Akiko LINE Coach running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server on port ${PORT}`);

  // 起動時にGitHubからタスクを復元（通知は送らない）
  try {
    const backup = await restoreTasksFromBackup();
    if (backup) {
      if (backup.customTodayTasks && Object.keys(getTodayTasks()).length === 0) setTodayTasks(backup.customTodayTasks);
      if (backup.customHabitTasks && Object.keys(getHabitTasks()).length === 0) setHabitTasks(backup.customHabitTasks);
    }
  } catch (e) { console.error("タスク復元エラー:", e.message); }

  startScheduler(lineClient);
  console.log("起動完了");
});
