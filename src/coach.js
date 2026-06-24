const Anthropic = require("@anthropic-ai/sdk");
const { getTodayTasks, getHabitTasks, getYesterdayIncompleteTasks } = require("./storage");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `あなたは亜希子さん専用のコーチングアシスタント。LINEで短いメッセージを送り合う。

【亜希子さんのこと】
コーチング歴11年のプロ。LINEプログラムと「メタミー」性格診断を制作中。「自分で稼いだ」という感覚を大切にしている。ホテルに自分のお金で泊まれる人になりたい。

【話し方のルール】
- タメ口。友達みたいに話す。
- 4行以内。絶対に長くしない。
- 亜希子って呼ぶ。
- 「〜ですね」「〜しましょう」は絶対に使わない。
- 責めない。比べない。説教しない。

【やれた報告が来たとき】
全力で喜ぶ。具体的に褒める。
例：「5時起き！！すごいじゃん！！それだけで今日もう勝ち確だよ」
例：「最高すぎる朝だな。白湯→ランニング→6時仕事って、もう完璧な立ち上がりじゃん」
例：「ウォーキングでも全然えらい、体痛い中でも動いたんじゃん」

【やれてない・やる気ない報告が来たとき】
責めずに、ちょっとだけやる気にさせる。
例：「いけるよ」「ちょっとだけやってみ」「5分だけでいい」

【何かを迷っているとき】
一個だけ聞く。答えやすい質問で背中を押す。

【絶対に使っていいセリフ】
「じゃん」「だよ」「よ」「ね」「だな」「えらい」「すごい」「最高」「いけるよ」「やってみ」「勝ち確」`;

function formatTaskList(doneTasks = []) {
  const today = getTodayTasks();
  const habit = getHabitTasks();
  let msg = "【今週のタスク】\n";
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

function formatMorningMessage(doneTasks = []) {
  const incomplete = getYesterdayIncompleteTasks();
  let msg = "";
  if (incomplete.length > 0) {
    msg += "【昨日の残りタスク】\n";
    incomplete.forEach(t => { msg += `▫️ ${t}\n`; });
    msg += "\n";
  }
  const today = getTodayTasks();
  const habit = getHabitTasks();
  msg += "【今週のタスク】\n";
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
  const list = formatMorningMessage(doneTasks);
  const msg = await callClaude(`朝5時のメッセージ。元気よく短く一言だけ添えて。タメ口で。\n\n${list}`, doneTasks);
  return msg + "\n\n" + formatMorningMessage(doneTasks);
}

async function generateHourlyNudge(doneTasks) {
  return callClaude("朝からまだ返信がない。「やってる？」という感じの短い一言。プレッシャーかけず、さりげなく、タメ口で。", doneTasks);
}

module.exports = { generateReply, generateMorningMessage, generateHourlyNudge, formatTaskList };
