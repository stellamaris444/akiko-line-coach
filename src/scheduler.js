const cron = require("node-cron");
const { getState, resetDaily } = require("./storage");
const { generateMorningMessage, generateEveningNudge } = require("./coach");

function startScheduler(lineClient) {
  // 毎朝8時：タスク確認メッセージ
    cron.schedule(
        "0 8 * * *",
            async () => {
                  const { userId, doneTasks } = getState();
                        if (!userId) return;
                              try {
                                      const msg = await generateMorningMessage(doneTasks);
                                              await lineClient.pushMessage(userId, { type: "text", text: msg });
                                                    } catch (e) { console.error("Morning error:", e.message); }
                                                        },
                                                            { timezone: "Asia/Tokyo" }
                                                              );

                                                                // 毎晉21時：背中を押す
                                                                  cron.schedule(
                                                                      "0 21 * * *",
                                                                          async () => {
                                                                                const { userId, doneTasks } = getState();
                                                                                      if (!userId) return;
                                                                                            try {
                                                                                                    const msg = await generateEveningNudge(doneTasks);
                                                                                                            await lineClient.pushMessage(userId, { type: "text", text: msg });
                                                                                                                  } catch (e) { console.error("Evening error:", e.message); }
                                                                                                                      },
                                                                                                                          { timezone: "Asia/Tokyo" }
                                                                                                                            );
                                                                                                                            
                                                                                                                              // 毎敥0時：日次リセット
                                                                                                                                cron.schedule("0 0 * * *", () => { resetDaily(); }, { timezone: "Asia/Tokyo" });
                                                                                                                                
                                                                                                                                  console.log("Scheduler started (JST: 8am / 9pm)");
                                                                                                                                  }
                                                                                                                                  
                                                                                                                                  module.exports = { startScheduler };
