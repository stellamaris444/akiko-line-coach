require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const { getState, setUserId, markTaskDone, updateActivity, resetDaily, getTasks, setTasks } = require("./storage");
const { generateReply, formatTaskList } = require("./coach");
const { startScheduler } = require("./scheduler");

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const lineClient = new line.Client(lineConfig);
const app = express();

app.post("/webhook", line.middleware(lineConfig), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.json({ status: "ok" });
  } catch (err) { console.error(err); res.status(500).end(); }
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return;
  const userId = event.source.userId;
  const text = event.message.text.trim();
  setUserId(userId); updateActivity();

  let replyText;

  if (text === "タスク" || text === "今日のタスク") {
    replyText = formatTaskList(getState().doneTasks);

  } else if (text.startsWith("タスク設定")) {
    const lines = text.split("\n").slice(1).filter(l => l.includes(":"));
    if (lines.length === 0) {
      replyText = "新しいタスクをこの形式で送って！\n\nタスク設定\nカテゴリ名: タスク1, タスク2\n\n例:\nタスク設定\nLINE特典: テーマ決め, 本文書く\nメタミー: 質問書く, 説明文書く";
    } else {
      const newTasks = {};
      for (const l of lines) {
        const idx = l.indexOf(":");
        const cat = l.slice(0, idx).trim();
        const items = l.slice(idx + 1).split(",").map(t => t.trim()).filter(Boolean);
        if (cat && items.length > 0) newTasks[cat] = items;
      }
      if (Object.keys(newTasks).length > 0) {
        setTasks(newTasks); resetDaily();
        replyText = "更新した！\n\n" + formatTaskList([]);
      } else {
        replyText = "形式が読み取れなかった。もう一度送って！";
      }
    }

  } else {
    const { doneTasks } = getState();
    replyText = await generateReply(text, doneTasks);
    if (/やった|完了|できた|終わった/.test(text)) {
      const tasks = getTasks();
      for (const list of Object.values(tasks)) {
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
app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  startScheduler(lineClient);
});
