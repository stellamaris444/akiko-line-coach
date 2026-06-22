require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const { getState, setUserId, markTaskDone, updateActivity } = require("./storage");
const { generateReply, formatTaskList } = require("./coach");
const { startScheduler } = require("./scheduler");
const tasks = require("../tasks");

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
                } catch (err) {
                    console.error(err);
                        res.status(500).end();
                          }
                          });

                          async function handleEvent(event) {
                            if (event.type !== "message" || event.message.type !== "text") return;
                              const userId = event.source.userId;
                                const text = event.message.text.trim();
                                  setUserId(userId);
                                    updateActivity();

                                      let replyText;
                                        if (text === "タスク" || text === "今日のタスク") {
                                            const { doneTasks } = getState();
                                                replyText = formatTaskList(doneTasks);
                                                  } else {
                                                      const { doneTasks } = getState();
                                                          replyText = await generateReply(text, doneTasks);
                                                              if (/やった|完了|できた|終わった|終わらせた/.test(text)) {
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
