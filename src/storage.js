const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data.json");

function load() {
  try {
      if (fs.existsSync(FILE)) {
            return JSON.parse(fs.readFileSync(FILE, "utf8"));
                }
                  } catch {}
                    return { userId: null, doneTasks: [], lastActivity: null };
                    }

                    function save(data) {
                      fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
                      }

                      function getState() { return load(); }

                      function setUserId(userId) {
                        const state = load();
                          state.userId = userId;
                            save(state);
                            }

                            function markTaskDone(taskName) {
                              const state = load();
                                if (!state.doneTasks.includes(taskName)) state.doneTasks.push(taskName);
                                  state.lastActivity = new Date().toISOString();
                                    save(state);
                                    }

                                    function resetDaily() {
                                      const state = load();
                                        state.doneTasks = [];
                                          save(state);
                                          }

                                          function updateActivity() {
                                            const state = load();
                                              state.lastActivity = new Date().toISOString();
                                                save(state);
                                                }

                                                module.exports = { getState, setUserId, markTaskDone, resetDaily, updateActivity };
