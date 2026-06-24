require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const { getState, setUserId, markTaskDone, updateActivity, resetDaily, getTodayTasks, getHabitTasks, setTodayTasks, setHabitTasks, morningWasSentToday, hasRespondedSinceMorning, setMorningMessageSent } = require("./storage");
const { generateReply, formatTaskList, generateMorningMessage, generateHourlyNudge } = require("./coach");
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

// ping エンドポイント：cron-job.orgが叩くたびに時間チェックして必要なら配信
app.get("/ping", async (req, res) => {
  res.json({ status: "alive", time: new Date().toISOString() });

  const { userId, doneTasks } = getState();
  if (!userId) return;

  const now = new Date();
  // 日本時間に変換
  const jst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const hour = jst.getHours();
  const day = jst.getDay(); // 0=日曜

  // 日曜は何もしない
  if (day === 0) return;

  // 5時台：朝のメッセージ未送信なら送る
  if (hour === 5 && !morningWasSentToday()) {
    try {
      const msg = await generateMorningMessage(doneTasks);
      await lineClient.pushMessage(userId, { type: "text", text: msg });
      setMorningMessageSent();
      console.log("Morning message sent via /ping");
    } catch (e) { console.error("Morning via ping error:", e.message); }
    return;
  }

  // 6〜15時：朝のメッセージ送信済みで返信なければナッジ
  if (hour >= 6 && hour <= 15 && morningWasSentToday() && !hasRespondedSinceMorning()) {
    // 最後のナッジから1時間以上経ってるか確認（連打防止）
    const state = getState();
    const lastNudge = state.lastNudgeAt ? new Date(state.lastNudgeAt) : null;
    const minutesSinceLastNudge = lastNudge ? (now - lastNudge) / 60000 : 999;
    if (minutesSinceLastNudge >= 55) {
      try {
        const msg = await generateHourlyNudge(doneTasks);
        await lineClient.pushMessage(userId, { type: "text", text: msg });
        const s = getState(); s.lastNudgeAt = now.toISOString();
        const fs = require("fs"), path = require("path");
        const FILE = path.join(__dirname, "..", "data.json");
        fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
        console.log("Hourly nudge sent via /ping");
      } catch (e) { console.error("Nudge via ping error:", e.message); }
    }
  }
});

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
      replyText = "形式はこれで送って！\n\n今日のタスク設定\nカテゴリ名: タスク1, タスク2\n\n例:\n今日のタスク設定\nLINE特典: テーマ決め, 本文書く";
    } else {
      setTodayTasks(parsed); resetDaily();
      replyText = "今日のタスク更新した！\n\n" + formatTaskList([]);
    }
  } else if (text.startsWith("習慣タスク設定")) {
    const parsed = parseTaskCommand(text);
    if (!parsed) {
      replyText = "形式はこれで送って！\n\n習慣タスク設定\nカテゴリ名: タスク1, タスク2";
    } else {
      setHabitTasks(parsed);
      replyText = "習慣タスク更新した！\n\n" + formatTaskList([]);
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

  return lineClient.replyMessage(event.replyToken, { type: "text", text: replyText });
}

app.get("/", (req, res) => res.send("Akiko LINE Coach running"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server on port ${PORT}`); startScheduler(lineClient); });
