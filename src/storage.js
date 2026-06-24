const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "data.json");

function load() {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {}
  return { userId: null, doneTasks: [], lastActivity: null, customTodayTasks: null, customHabitTasks: null, morningMessageSentAt: null, lastResponseAt: null, yesterdayIncompleteTasks: [] };
}

function save(data) { fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8"); }
function getState() { return load(); }
function setUserId(id) { const s = load(); s.userId = id; save(s); }
function markTaskDone(name) { const s = load(); if (!s.doneTasks.includes(name)) s.doneTasks.push(name); s.lastActivity = new Date().toISOString(); save(s); }

function resetDaily() {
  const s = load();
  const allTasks = [];
  const today = s.customTodayTasks || require("../tasks").todayTasks;
  const habit = s.customHabitTasks || require("../tasks").habitTasks;
  for (const list of Object.values({ ...today, ...habit })) {
    for (const task of list) allTasks.push(task);
  }
  s.yesterdayIncompleteTasks = allTasks.filter(t => !s.doneTasks.includes(t));
  s.doneTasks = [];
  s.morningMessageSentAt = null;
  save(s);
}

function updateActivity() { const s = load(); s.lastActivity = new Date().toISOString(); s.lastResponseAt = new Date().toISOString(); save(s); }

function getTodayTasks() {
  const s = load();
  if (s.customTodayTasks && Object.keys(s.customTodayTasks).length > 0) return s.customTodayTasks;
  return require("../tasks").todayTasks;
}
function getHabitTasks() {
  const s = load();
  if (s.customHabitTasks && Object.keys(s.customHabitTasks).length > 0) return s.customHabitTasks;
  return require("../tasks").habitTasks;
}
function setTodayTasks(t) { const s = load(); s.customTodayTasks = t; save(s); }
function setHabitTasks(t) { const s = load(); s.customHabitTasks = t; save(s); }
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

// 最後の活動から1時間以上経過しているか
function hasBeenInactiveFor1Hour() {
  const s = load();
  if (!s.lastActivity) return true;
  const diff = new Date() - new Date(s.lastActivity);
  return diff > 60 * 60 * 1000;
}

module.exports = { getState, setUserId, markTaskDone, resetDaily, updateActivity, getTodayTasks, getHabitTasks, setTodayTasks, setHabitTasks, setMorningMessageSent, morningWasSentToday, hasRespondedSinceMorning, getYesterdayIncompleteTasks, hasBeenInactiveFor1Hour };
