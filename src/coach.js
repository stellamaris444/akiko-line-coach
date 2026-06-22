const Anthropic = require("@anthropic-ai/sdk");
const { getTodayTasks, getHabitTasks } = require("./storage");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `あなたは亜希子さん専用のコーチングアシスタント。LINEで短いメッセージを送り合う。
コーチング歴11年のプロ。LINEプログラムとメタミー性格診断を制作中。「自分で稼いだ」という感覚を大切にしている。
スタイル：友達みたいにタメ口。5行以内。責めない。「いけるよ」「ちょっとだけやってみ」。やれた報告は全力で喜ぶ。亜希子って呼ぶ。`;

function formatTaskList(doneTasks = []) {
  const today = getTodayTasks();
  const habit = getHabitTasks();
  let msg = "【今日のタスク】\n";
  for (const [cat, list] of Object.entries(today)) {
    msg += `\n〈${cat}〉\n`;
    list.forEach(t => { msg += `${doneTasks.includes(t) ? "✅" : "▫️"} ${t}\n`; });
  }
  msg += "\n【毎日の習慣】\n";
  for (const [cat, list] of Object.entries(habit)) {
    msg += `\n〈${cat}〉\n`;
    list.forEach(t => { msg += `${doneTasks.includes(t) ? "✅" : "▫️"} ${t}\n`; });
  }
  return msg.trim();
}

async function callClaude(prompt, doneTasks = []) {
  const ctx = `\n\n現在のタスク状況（完了済み）: ${JSON.stringify(doneTasks)}`;
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 300,
    system: SYSTEM + ctx,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content[0].text;
}

async function generateReply(text, doneTasks) { return callClaude(text, doneTasks); }

async function generateMorningMessage(doneTasks) {
  const list = formatTaskList(doneTasks);
  return callClaude(`今日の朝6時のメッセージを送って。タスクリストを以下の内容で伝えて。元気よく短く。\n\n${list}`, doneTasks);
}

async function generateEveningNudge(doneTasks) {
  const n = doneTasks.length;
  return callClaude(n === 0 ? "今日まだ何もやってない。責めず、ちょっとだけやる気にさせて。" : `今日${n}個やれた。もう少しいける気がするから優しく背中を押して。`, doneTasks);
}

async function generateHourlyNudge(doneTasks) {
  return callClaude("朝からまだ返信がない。「やってる？」という感じの短い一言を送って。プレッシャーをかけず、さりげなく。", doneTasks);
}

module.exports = { generateReply, generateMorningMessage, generateEveningNudge, generateHourlyNudge, formatTaskList };
