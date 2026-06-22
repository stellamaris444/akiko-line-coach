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

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data.json");

function load() {
    try {
          if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, "utf8"));
    } catch {}
    return { userId: null, doneTasks: [], lastActivity: null, customTasks: null };
}

function save(data) {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
}

function getState() { return load(); }

function setUserId(userId) {
    const s = load(); s.userId = userId; save(s);
}

function markTaskDone(taskName) {
    const s = load();
    if (!s.doneTasks.includes(taskName)) s.doneTasks.push(taskName);
    s.lastActivity = new Date().toISOString();
    save(s);
}

function resetDaily() {
    const s = load(); s.doneTasks = []; save(s);
}

function updateActivity() {
    const s = load(); s.lastActivity = new Date().toISOString(); save(s);
}

function getTasks() {
    const s = load();
    if (s.customTasks && Object.keys(s.customTasks).length > 0) return s.customTasks;
    return require("../tasks");
}

function setTasks(newTasks) {
    const s = load(); s.customTasks = newTasks; save(s);
}

module.exports = { getState, setUserId, markTaskDone, resetDaily, updateActivity, getTasks, setTasks };function getState() { return load(); }

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
