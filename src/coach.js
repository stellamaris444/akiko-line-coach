const Anthropic = require("@anthropic-ai/sdk");
const tasks = require("../tasks");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `あなたは亚希子さん専用のコーチングアシスタントです。LINEで短いメッセージを送り合います。

【亚希子さんについて】
コーチング歴１11年のプロ。LINEプログラムとメタミー性格診断を制作中。
「自分で稼いだ」という感覚を大切にしていて、いいホテルや旅行に自分のお金で行くのが目標。

【スタイル】
- 友達みたいに話す。散文慧（タメ口）
- メッセージは短く。改行を使ってスマホで読みやすく
- 諃めない。押しつけがましくない
- 「頑張れ」より「いけるよ」「ちょっとだけやってみ」
- やれた報告が来たら全力で喜ぶ。大げさなくらいでOK
- 亚希子って呼ぶ（さん不要）`;

function formatTaskList(doneTasks = []) {
  let msg = "【今日のタスク】\n\n";
  for (const [cat, list] of Object.entries(tasks)) {
    msg += `《${cat}》\n`;
    list.forEach(t => { msg += `${doneTasks.includes(t) ? "✅" : "▫️"} ${t}\n`; });
    msg += "\n";
  }
  return msg.trim();
}

async function callClaude(userMsg, doneTasks = []) {
  const ctx = `\n\n「タスク」と送られたらリストを返す。\n現在の状況: ${JSON.stringify(doneTasks)}`;
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: SYSTEM + ctx,
    messages: [{ role: "user", content: userMsg }],
});
  return res.content[0].text;
}

async function generateReply(msg, doneTasks) { return callClaude(msg, doneTasks); }

async function generateMorningMessage(doneTasks) {
  return callClaude("今日の朗がい朝のアプローチメッセージとタスクリストを送って。元気よく短く。", doneTasks);
}

async function generateEveningNudge(doneTasks) {
  const n = doneTasks.length;
  return callClaude(n === 0 ? "今日まだ何もやってない。责めず、ちょっとだけやる気にさせて。" : `今日${n}個やれた。もう少しいけるかも、優しく背中を押して。`, doneTasks);
}

module.exports = { generateReply, generateMorningMessage, generateEveningNudge, formatTaskList };
