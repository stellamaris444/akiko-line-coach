const fs = require("fs");
const path = require("path");
const https = require("https");
const FILE = path.join(__dirname, "..", "data.json");
const REPO = "stellamaris444/akiko-line-coach";
const BACKUP_FILE = "user_tasks.json";

function load() {
  try {
    if (fs.existsSync(FILE)) {
      const s = JSON.parse(fs.readFileSync(FILE, "utf8"));
      if (s.customWeeklyTasks === undefined) s.customWeeklyTasks = null;
      if (!s.doneWeeklyTasks) s.doneWeeklyTasks = [];
      return s;
    }
  } catch {}
  return { userId: null, doneTasks: [], doneWeeklyTasks: [], lastActivity: null, customTodayTasks: null, customWeeklyTasks: null, customHabitTasks: null, morningMessageSentAt: null, lastResponseAt: null, yesterdayIncompleteTasks: [] };
}

function loadDefaultTasks() {
  try { return require("../tasks"); } catch { return { todayTasks: {}, habitTasks: {}, weeklyTasks: {} }; }
}

function save(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8"); }

function githubRequest(method, filePath, body, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: `/repos/${REPO}/contents/${filePath}`,
      method,
      headers: { "Authorization": `token ${token}`, "Content-Type": "application/json", "User-Agent": "akiko-line-coach" }
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function backupTasks(todayTasks, habitTasks, weeklyTasks) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return;
  try {
    const current = await githubRequest("GET", BACKUP_FILE, null, token);
    const sha = current.sha;
    const content = Buffer.from(JSON.stringify({ customTodayTasks: todayTasks, customHabitTasks: habitTasks, customWeeklyTasks: weeklyTasks, updatedAt: new Date().toISOString() }, null, 2)).toString("base64");
    await githubRequest("PUT", BACKUP_FILE, { message: "Auto-backup tasks", content, sha }, token);
    console.log("タスクをGitHubにバックアップしました");
  } catch (e) { console.error("バックアップ失敗:", e.message); }
}

async function restoreTasksFromBackup() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  try {
    const result = await githubRequest("GET", BACKUP_FILE, null, token);
    if (!result.content) return null;
    const data = JSON.parse(Buffer.from(result.content, "base64").toString());
    if (data.customTodayTasks || data.customHabitTasks || data.customWeeklyTasks) {
      console.log("GitHubからタスクを復元しました");
      return data;
    }
  } catch {}
  return null;
}

function getState() {
  const s = load();
  if (!s.userId && process.env.LINE_USER_ID) s.userId = process.env.LINE_USER_ID;
  return s;
}

function setUserId(id) {
  const s = load();
  s.userId = id;
  save(s);
  if (!process.env.LINE_USER_ID) console.log("★ LINE_USER_ID:", id, "← Renderの環境変数に追加してください");
}

function markTaskDone(name) { const s = load(); if (!s.doneTasks.includes(name)) s.doneTasks.push(name); s.lastActivity = new Date().toISOString(); save(s); }
function markWeeklyTaskDone(name) { const s = load(); if (!s.doneWeeklyTasks.includes(name)) s.doneWeeklyTasks.push(name); s.lastActivity = new Date().toISOString(); save(s); }

function resetDaily() {
  const s = load();
  const defaults = loadDefaultTasks();
  const allTasks = [];
  const today = s.customTodayTasks || defaults.todayTasks;
  const habit = s.customHabitTasks || defaults.habitTasks;
  for (const list of Object.values({ ...today, ...habit })) for (const task of list) allTasks.push(task);
  s.yesterdayIncompleteTasks = allTasks.filter(t => !s.doneTasks.includes(t));
  s.doneTasks = [];
  s.morningMessageSentAt = null;
  save(s);
}

// 週間タスクの完了状態だけをリセット(週初めなどに手動で呼ぶ想定)
function resetWeekly() {
  const s = load();
  s.doneWeeklyTasks = [];
  save(s);
}

function updateActivity() { const s = load(); s.lastActivity = new Date().toISOString(); s.lastResponseAt = new Date().toISOString(); save(s); }

function getTodayTasks() {
  const s = load();
  if (s.customTodayTasks && Object.keys(s.customTodayTasks).length > 0) return s.customTodayTasks;
  return loadDefaultTasks().todayTasks;
}
function getHabitTasks() {
  const s = load();
  if (s.customHabitTasks && Object.keys(s.customHabitTasks).length > 0) return s.customHabitTasks;
  return loadDefaultTasks().habitTasks;
}
function getWeeklyTasks() {
  const s = load();
  if (s.customWeeklyTasks && Object.keys(s.customWeeklyTasks).length > 0) return s.customWeeklyTasks;
  const defaults = loadDefaultTasks();
  return defaults.weeklyTasks || {};
}
function setTodayTasks(t) { const s = load(); s.customTodayTasks = t; save(s); backupTasks(t, s.customHabitTasks, s.customWeeklyTasks); }
function setHabitTasks(t) { const s = load(); s.customHabitTasks = t; save(s); backupTasks(s.customTodayTasks, t, s.customWeeklyTasks); }
function setWeeklyTasks(t) { const s = load(); s.customWeeklyTasks = t; s.doneWeeklyTasks = []; save(s); backupTasks(s.customTodayTasks, s.customHabitTasks, t); }
function setMorningMessageSent() { const s = load(); s.morningMessageSentAt = new Date().toISOString(); save(s); }
function getYesterdayIncompleteTasks() { return load().yesterdayIncompleteTasks || []; }

function morningWasSentToday() {
  const s = load();
  if (!s.morningMessageSentAt) return false;
  const sent = new Date(s.morningMessageSentAt);
  const now = new Date();
  return sent.getFullYear() === now.getFullYear() && sent.getMonth() === now.getMonth() && sent.getDate() === now.getDate();
}
function hasRespondedSinceMorning() {
  const s = load();
  if (!s.lastResponseAt || !s.morningMessageSentAt) return false;
  return new Date(s.lastResponseAt) > new Date(s.morningMessageSentAt);
}
function hasBeenInactiveFor1Hour() {
  const s = load();
  if (!s.lastActivity) return true;
  return new Date() - new Date(s.lastActivity) > 60 * 60 * 1000;
}

module.exports = { getState, setUserId, markTaskDone, markWeeklyTaskDone, resetDaily, resetWeekly, updateActivity, getTodayTasks, getHabitTasks, getWeeklyTasks, setTodayTasks, setHabitTasks, setWeeklyTasks, setMorningMessageSent, morningWasSentToday, hasRespondedSinceMorning, getYesterdayIncompleteTasks, hasBeenInactiveFor1Hour, restoreTasksFromBackup };
