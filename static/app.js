const KEY = {
  SETTINGS: "unko-training-settings-v1",
  PROGRESS: "unko-training-progress-v1",
  CUSTOM: "unko-training-custom-questions-v1",
};

let allQuestions = [];
let customQuestions = null;
let mode = "learn";
let category = "すべて";
let order = "asc";
let numExam = 10;
let showExplain = true;
let index = 0;
let answers = {}; // qid -> choiceIndex
let list = [];
let listDirty = true;

// 学習モードは10問ごとに採点する
const LEARN_BATCH = 10;

/* 追加：このセットで使う問題IDの回答だけ消すユーティリティ */
function clearAnswersForIds(ids){
  let touched = false;
  ids.forEach(id=>{
    if (answers[id] !== undefined){
      delete answers[id];
      touched = true;
    }
  });
  if (touched) saveProgress();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function saveSettings() {
  localStorage.setItem(
    KEY.SETTINGS,
    JSON.stringify({ mode, category, order, numExam, showExplain })
  );
}
function saveProgress() {
  localStorage.setItem(KEY.PROGRESS, JSON.stringify(answers));
}
function resetProgress() {
  answers = {};
  index = 0;
  saveProgress();
  render();
}

function getFilteredBase() {
  const source =
    customQuestions && customQuestions.length ? customQuestions : allQuestions;
  return category === "すべて"
    ? source
    : source.filter((q) => (q.category || "").trim() === category);
}

function rebuildList() {
  const filtered = getFilteredBase();
  const ordered = order === "rand" ? shuffle(filtered) : filtered;
  if (mode === "exam") {
    const desired = Math.max(1, Math.min(Number(numExam) || 10, 100));
    const n = Math.min(desired, ordered.length);
    list = ordered.slice(0, n);
  } else {
    list = ordered;
  }
  index = 0;
  listDirty = false;
}

function correctCountIn(arr) {
  return arr.reduce(
    (acc, x) => (answers[x.id] === x.answerIndex ? acc + 1 : acc),
    0
  );
}

function render() {
  if (listDirty) rebuildList();

  const scoreText = document.getElementById("scoreText");
if (list.length) {
  scoreText.textContent = `${index + 1} / ${list.length}（正答 ${correctCountIn(list)}）`;
  document.getElementById("progressBar").style.width =
    Math.round(((index + 1) / list.length) * 100) + "%";
} else {
  scoreText.textContent = "0 / 0（正答 0）";
  document.getElementById("progressBar").style.width = "0%";
}


  const area = document.getElementById("cardArea");
  area.innerHTML = "";

  // 学習モード 10問ごとに結果画面
  if (mode === "learn" && list.length > 0) {
    const batchLimit = Math.min(LEARN_BATCH, list.length);
    if (index >= batchLimit) {
      const batch = list.slice(0, batchLimit);
      const total = batch.length;
      const correct = correctCountIn(batch);
      const rate = Math.round((correct / total) * 100);

      scoreText.textContent = `学習バッチ結果：${correct} / ${total}（正答 ${correct}）`;
      document.getElementById("progressBar").style.width = "100%";

      const div = document.createElement("div");
      div.className = "text-center bg-white rounded-2xl shadow p-8";
      div.innerHTML = `
        <h2 class="text-xl font-bold mb-4">学習モード 結果（${total}問）</h2>
        <p class="mb-2">正解数：${correct} 問</p>
        <p class="mb-6">正答率：${rate}%</p>
        <div class="flex items-center justify-center gap-3">
          <button id="retryLearnBatch" class="px-4 py-2 rounded-xl border hover:bg-gray-50">この10問をやり直す</button>
          <button id="nextLearnBatch" class="px-4 py-2 rounded-xl border hover:bg-gray-50">次の10問へ</button>
        </div>
      `;
      area.appendChild(div);

      // やり直す → このバッチの回答をクリア
      document
        .getElementById("retryLearnBatch")
        .addEventListener("click", () => {
          clearAnswersForIds(batch.map(x=>x.id));
          index = 0;
          render();
        });

      // 次の10問へ
      document
        .getElementById("nextLearnBatch")
        .addEventListener("click", () => {
          list = list.slice(batchLimit);
          index = 0;
          if (list.length === 0) {
            const area2 = document.getElementById("cardArea");
            area2.innerHTML = `
              <div class="text-center bg-white rounded-2xl shadow p-8">
                <h2 class="text-xl font-bold mb-4">学習完了</h2>
                <p class="mb-6">このカテゴリ（または条件）の学習が完了しました。</p>
                <button id="restartLearnAll" class="px-4 py-2 rounded-xl border hover:bg-gray-50">最初からやり直す</button>
              </div>
            `;
            document
              .getElementById("restartLearnAll")
              .addEventListener("click", () => {
                listDirty = true;
                rebuildList();
                clearAnswersForIds(list.map(x=>x.id));
                render();
              });
          } else {
            render();
          }
        });
      return;
    }
  }

  // 模擬試験モード：全問終了で結果表示
  if (mode === "exam" && list.length > 0 && index >= list.length) {
    const total = list.length;
    const correct = correctCountIn(list);
    const rate = Math.round((correct / total) * 100);

    const div = document.createElement("div");
    div.className = "text-center bg-white rounded-2xl shadow p-8";
    div.innerHTML = `
      <h2 class="text-xl font-bold mb-4">模擬試験 結果</h2>
      <p class="mb-2">出題数：${total} 問</p>
      <p class="mb-2">正解数：${correct} 問</p>
      <p class="mb-6">正答率：${rate}%</p>
      <div class="flex items-center justify-center gap-3">
        <button id="retryExam" class="px-4 py-2 rounded-xl border hover:bg-gray-50">もう一度</button>
        <button id="toLearn" class="px-4 py-2 rounded-xl border hover:bg-gray-50">学習モードへ</button>
      </div>
    `;
    area.appendChild(div);

    // もう一度 → 新セット作成＆回答クリア
    document.getElementById("retryExam").addEventListener("click", () => {
      listDirty = true;
      rebuildList();
      clearAnswersForIds(list.map(x=>x.id));
      index = 0;
      render();
    });

    document.getElementById("toLearn").addEventListener("click", () => {
      mode = "learn";
      saveSettings();
      listDirty = true;
      rebuildList();
      clearAnswersForIds(list.map(x=>x.id));
      index = 0;
      render();
    });
    return;
  }

  // 通常の問題表示
  const q = list[index];
  if (!q) {
    const div = document.createElement("div");
    div.className =
      "text-center text-gray-500 bg-white rounded-2xl shadow p-10";
    div.textContent =
      "条件に合う問題がありません。フィルタや検索条件を見直してください。";
    area.appendChild(div);
    return;
  }

  const card = document.createElement("div");
  card.className = "bg-white rounded-2xl shadow p-5 md:p-6";
  card.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="text-xs text-gray-500 font-medium">ID: ${q.id} ・ カテゴリ: ${q.category}</div>
      <div class="text-xs text-gray-500">${
        answers[q.id] === undefined
          ? "未回答"
          : answers[q.id] === q.answerIndex
          ? '<span class="text-green-600 font-semibold">正解</span>'
          : '<span class="text-red-600 font-semibold">不正解</span>'
      }</div>
    </div>
    <h2 class="text-lg md:text-xl font-semibold mt-3 leading-relaxed">${
      q.question
    }</h2>
    <ul id="choices" class="mt-4 space-y-2"></ul>
    <div id="explain" class="mt-4 p-4 rounded-xl bg-gray-50 border text-sm leading-relaxed" style="display:none;"></div>
    <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
      <div class="text-xs text-gray-500">${
        mode === "exam"
          ? "模試: 出題は固定/ランダムから選択・出題数で制御"
          : "学習: 10問ごとに採点結果が表示されます"
      }</div>
      <div class="flex items-center gap-2">
        <button id="prevBtn" class="px-4 py-2 rounded-xl border hover:bg-gray-50">前へ</button>
        <button id="nextBtn" class="px-4 py-2 rounded-xl border hover:bg-gray-50">次へ</button>
      </div>
    </div>
  `;
  area.appendChild(card);

  const ul = card.querySelector("#choices");
  q.choices.forEach((c, i) => {
    const selected = answers[q.id] === i;
    const isCorrect = q.answerIndex === i;
    const isAnswered = answers[q.id] !== undefined;
    const showState = isAnswered && (selected || isCorrect);

    const li = document.createElement("li");
    const btn = document.createElement("button");

    // ★ 回答済みなら無効化（クリック不可に）
    const disabled = isAnswered;
    btn.disabled = disabled;

    btn.className = [
      "w-full text-left border rounded-xl px-4 py-3 transition",
      selected ? "border-blue-500 ring-1 ring-blue-200" : "border-gray-200",
      showState && isCorrect ? "bg-green-50 border-green-400" : "",
      showState && selected && !isCorrect ? "bg-red-50 border-red-400" : "",
      disabled ? "opacity-60 cursor-not-allowed" : ""
    ].join(" ");

    // ツールチップ（任意）
    if (disabled) btn.title = "この問題は回答済みです。";

    btn.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center">
          ${
            selected
              ? '<span class="text-xs">●</span>'
              : '<span class="text-xs text-gray-300">○</span>'
          }
        </div>
        <span>${c}</span>
      </div>
    `;

    btn.addEventListener("click", () => {
      // 二重ガード：念のため回答済みなら無視
      if (answers[q.id] !== undefined) return;
      answers[q.id] = i;
      saveProgress();
      render();
    });

    li.appendChild(btn);
    ul.appendChild(li);
  });

  const exp = card.querySelector("#explain");
  if (showExplain && answers[q.id] !== undefined) {
    exp.style.display = "block";
    exp.innerHTML = `正解: <span class="font-semibold">${
      q.choices[q.answerIndex]
    }</span>` + (q.explanation ? `<div class="mt-2">${q.explanation}</div>` : "");
  }

  card.querySelector("#prevBtn").addEventListener("click", () => {
    index = Math.max(0, index - 1);
    render();
  });
  card.querySelector("#nextBtn").addEventListener("click", () => {
    if (mode === "exam") {
      if (index >= list.length - 1) {
        index = list.length;
      } else {
        index++;
      }
    } else {
      const batchLimit = Math.min(LEARN_BATCH, list.length);
      if (index >= batchLimit - 1) {
        index = batchLimit; // 結果画面へ
      } else {
        index++;
      }
    }
    render();
  });
}

// Import/Export
function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY.SETTINGS) || "{}");
    mode = s.mode || "learn";
    category = s.category || "すべて";
    order = s.order || "asc";
    numExam = s.numExam || 10;
    showExplain =
      typeof s.showExplain === "boolean" ? s.showExplain : true;

    answers = JSON.parse(localStorage.getItem(KEY.PROGRESS) || "{}");
    const custom = localStorage.getItem(KEY.CUSTOM);
    if (custom) {
      customQuestions = JSON.parse(custom);
    }
  } catch {}

  try {
    const res = await fetch("/questions");
    const q = await res.json();
    allQuestions = Array.isArray(q) ? q : [];
  } catch (e) {
    console.error("質問の読み込みに失敗:", e);
    allQuestions = [];
  }

  const modeSel = document.getElementById("modeSel");
  const catSel = document.getElementById("catSel");
  const orderSel = document.getElementById("orderSel");
  const examCountWrap = document.getElementById("examCountWrap");
  const examCount = document.getElementById("examCount");
  const toggleExplain = document.getElementById("toggleExplain");
  const resetBtn = document.getElementById("resetBtn");

  const source =
    customQuestions && customQuestions.length ? customQuestions : allQuestions;
  const rawCats = source.map((q) => (q.category || "").trim());
  const cats = new Set(
    ["すべて", ...rawCats.filter((c) => c && c !== "すべて" && c !== "全て")]
  );

  catSel.innerHTML = "";
  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    catSel.appendChild(opt);
  });

  modeSel.value = mode;
  catSel.value = cats.has(category) ? category : "すべて";
  orderSel.value = order;
  examCount.value = numExam;
  examCountWrap.style.display = mode === "exam" ? "" : "none";
  toggleExplain.textContent = showExplain ? "解説を隠す" : "解説を表示";

  // モード切替時：新しく組まれるセットの回答を自動でクリア
  modeSel.addEventListener("change", () => {
    mode = modeSel.value;
    examCountWrap.style.display = mode === "exam" ? "" : "none";
    saveSettings();
    listDirty = true;
    rebuildList();
    clearAnswersForIds(list.map(x=>x.id));
    index = 0;
    render();
  });

  catSel.addEventListener("change", () => {
    category = catSel.value;
    saveSettings();
    listDirty = true;
    rebuildList();
    clearAnswersForIds(list.map(x=>x.id));
    index = 0;
    render();
  });

  orderSel.addEventListener("change", () => {
    order = orderSel.value;
    saveSettings();
    listDirty = true;
    rebuildList();
    clearAnswersForIds(list.map(x=>x.id));
    index = 0;
    render();
  });

  examCount.addEventListener("change", () => {
    numExam = Math.max(1, Math.min(Number(examCount.value) || 10, 100));
    saveSettings();
    listDirty = true;
    rebuildList();
    clearAnswersForIds(list.map(x=>x.id));
    index = 0;
    render();
  });

  toggleExplain.addEventListener("click", () => {
    showExplain = !showExplain;
    toggleExplain.textContent = showExplain ? "解説を隠す" : "解説を表示";
    saveSettings();
    render();
  });

  resetBtn.addEventListener("click", resetProgress);

  // 初回も現在のセット分は未回答スタートに揃える
  if (listDirty) {
    rebuildList();
    clearAnswersForIds(list.map(x=>x.id));
  }

  render();
});
