
const KEY = {
  SETTINGS: "unko-training-settings-v1",
  PROGRESS: "unko-training-progress-v1",
  CUSTOM: "unko-training-custom-questions-v1",
};

let allQuestions = [];
let customQuestions = null;
let mode = "learn";
let category = "すべて";
let query = "";
let order = "asc";
let numExam = 10;
let showExplain = true;
let index = 0;
let answers = {}; // qid -> choiceIndex
let list = []; // currently displayed set (filtered or exam set)

function shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
function saveSettings(){ localStorage.setItem(KEY.SETTINGS, JSON.stringify({mode,category,query,order,numExam,showExplain})); }
function saveProgress(){ localStorage.setItem(KEY.PROGRESS, JSON.stringify(answers)); }
function resetProgress(){ answers={}; index=0; saveProgress(); render(); }

function filterQuestions(){
  const source = customQuestions && customQuestions.length ? customQuestions : allQuestions;
  const base = (category==="すべて") ? source : source.filter(q=>q.category===category);
  if(!query.trim()) return order==="rand" ? shuffle(base) : base;
  const q = query.trim();
  const searched = base.filter(x =>
    x.question.includes(q) || x.choices.some(c=>c.includes(q)) || (x.tags||[]).some(t=>t.includes(q))
  );
  return order==="rand" ? shuffle(searched) : searched;
}

function buildExamSet(filtered){
  const set = (order==="rand") ? shuffle(filtered) : filtered;
  const n = Math.max(1, Math.min(Number(numExam)||10, set.length));
  return set.slice(0, n);
}

function updateList(){
  const filtered = filterQuestions();
  list = (mode==="exam") ? buildExamSet(filtered) : filtered;
  if(index>=list.length) index=0;
}

function progressPct(){ return list.length ? Math.round(((index+1)/list.length)*100) : 0; }
function correctCount(){ return list.reduce((acc,x)=> (answers[x.id]===x.answerIndex?acc+1:acc),0); }

function render(){
  updateList();
  const scoreText = document.getElementById("scoreText");
  scoreText.textContent = list.length ? `${index+1} / ${list.length}（正答 ${correctCount()}）` : "0 / 0（正答 0）";
  document.getElementById("progressBar").style.width = progressPct()+"%";

  const area = document.getElementById("cardArea");
  area.innerHTML = "";
  const q = list[index];
  if(!q){
    const div = document.createElement("div");
    div.className = "text-center text-gray-500 bg-white rounded-2xl shadow p-10";
    div.textContent = "条件に合う問題がありません。フィルタや検索条件を見直してください。";
    area.appendChild(div);
    return;
  }

  const card = document.createElement("div");
  card.className = "bg-white rounded-2xl shadow p-5 md:p-6";
  card.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="text-xs text-gray-500 font-medium">ID: ${q.id} ・ カテゴリ: ${q.category}</div>
      <div class="text-xs text-gray-500">${answers[q.id]===undefined? "未回答" : (answers[q.id]===q.answerIndex? '<span class="text-green-600 font-semibold">正解</span>' : '<span class="text-red-600 font-semibold">不正解</span>')}</div>
    </div>
    <h2 class="text-lg md:text-xl font-semibold mt-3 leading-relaxed">${q.question}</h2>
    <ul id="choices" class="mt-4 space-y-2"></ul>
    <div id="explain" class="mt-4 p-4 rounded-xl bg-gray-50 border text-sm leading-relaxed" style="display:none;"></div>
    <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
      <div class="text-xs text-gray-500">${mode==="exam" ? "模試: 出題は固定/ランダムから選択・出題数で制御" : "学習: 絞り込みと検索で弱点対策"}</div>
      <div class="flex items-center gap-2">
        <button id="prevBtn" class="px-4 py-2 rounded-xl border hover:bg-gray-50">前へ</button>
        <button id="nextBtn" class="px-4 py-2 rounded-xl border hover:bg-gray-50">次へ</button>
      </div>
    </div>
  `;
  area.appendChild(card);

  const ul = card.querySelector("#choices");
  q.choices.forEach((c,i)=>{
    const selected = answers[q.id]===i;
    const isCorrect = q.answerIndex===i;
    const isAnswered = answers[q.id]!==undefined;
    const showState = isAnswered && (selected || isCorrect);

    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = [
      "w-full text-left border rounded-xl px-4 py-3 transition",
      selected? "border-blue-500 ring-1 ring-blue-200" : "border-gray-200",
      (showState && isCorrect) ? "bg-green-50 border-green-400" : "",
      (showState && selected && !isCorrect) ? "bg-red-50 border-red-400" : ""
    ].join(" ");
    btn.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center">
          ${selected? '<span class="text-xs">●</span>' : '<span class="text-xs text-gray-300">○</span>'}
        </div>
        <span>${c}</span>
      </div>
    `;
    btn.addEventListener("click", ()=>{
      answers[q.id] = i;
      saveProgress();
      render();
    });
    li.appendChild(btn);
    ul.appendChild(li);
  });

  const exp = card.querySelector("#explain");
  if(showExplain && answers[q.id]!==undefined){
    exp.style.display = "block";
    exp.innerHTML = `正解: <span class="font-semibold">${q.choices[q.answerIndex]}</span>` + (q.explanation? `<div class="mt-2 whitespace-pre-wrap">${q.explanation}</div>` : "");
  }

  card.querySelector("#prevBtn").addEventListener("click", ()=>{ index=Math.max(0,index-1); render(); });
  card.querySelector("#nextBtn").addEventListener("click", ()=>{ index=Math.min(list.length-1,index+1); render(); });
}

// Import/Export
function downloadJson(filename, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", async ()=>{
  // Load storage
  try{
    const s = JSON.parse(localStorage.getItem(KEY.SETTINGS) || "{}");
    mode = s.mode || "learn";
    category = s.category || "すべて";
    query = s.query || "";
    order = s.order || "asc";
    numExam = s.numExam || 10;
    showExplain = (typeof s.showExplain === "boolean") ? s.showExplain : true;

    answers = JSON.parse(localStorage.getItem(KEY.PROGRESS) || "{}");
    const custom = localStorage.getItem(KEY.CUSTOM);
    if(custom){ customQuestions = JSON.parse(custom); }
  }catch{}

  // Fetch default questions
  try{
    const res = await fetch("/questions");
    const q = await res.json();
    allQuestions = Array.isArray(q) ? q : [];
  }catch(e){
    console.error("質問の読み込みに失敗:", e);
    allQuestions = [];
  }

  // Setup UI binds
  const modeSel = document.getElementById("modeSel");
  const catSel = document.getElementById("catSel");
  const searchInput = document.getElementById("searchInput");
  const orderSel = document.getElementById("orderSel");
  const examCountWrap = document.getElementById("examCountWrap");
  const examCount = document.getElementById("examCount");
  const toggleExplain = document.getElementById("toggleExplain");
  const resetBtn = document.getElementById("resetBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const resetQuestionsBtn = document.getElementById("resetQuestionsBtn");

  // Build category list
  const source = customQuestions && customQuestions.length ? customQuestions : allQuestions;
  const cats = new Set(["すべて", ...source.map(q=>q.category)]);
  cats.forEach(c=>{
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    catSel.appendChild(opt);
  });

  // Initialize controls with saved state
  modeSel.value = mode;
  catSel.value = cats.has(category) ? category : "すべて";
  searchInput.value = query;
  orderSel.value = order;
  examCount.value = numExam;
  examCountWrap.style.display = (mode==="exam") ? "" : "none";
  toggleExplain.textContent = showExplain ? "解説を隠す" : "解説を表示";

  // Events
  modeSel.addEventListener("change", ()=>{ mode = modeSel.value; examCountWrap.style.display = (mode==="exam")? "" : "none"; saveSettings(); render(); });
  catSel.addEventListener("change", ()=>{ category = catSel.value; saveSettings(); render(); });
  searchInput.addEventListener("input", ()=>{ query = searchInput.value; saveSettings(); render(); });
  orderSel.addEventListener("change", ()=>{ order = orderSel.value; saveSettings(); render(); });
  examCount.addEventListener("change", ()=>{ numExam = Number(examCount.value)||10; saveSettings(); render(); });
  toggleExplain.addEventListener("click", ()=>{ showExplain = !showExplain; toggleExplain.textContent = showExplain? "解説を隠す" : "解説を表示"; saveSettings(); render(); });
  resetBtn.addEventListener("click", resetProgress);
  exportBtn.addEventListener("click", ()=>{
    const data = customQuestions && customQuestions.length ? customQuestions : allQuestions;
    downloadJson("questions_export.json", data);
  });
  importFile.addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    try{
      const text = await file.text();
      const json = JSON.parse(text);
      if(Array.isArray(json)){
        customQuestions = json;
        localStorage.setItem(KEY.CUSTOM, JSON.stringify(json));
        index = 0;
        render();
      }else{
        alert("配列(JSON Array)形式の問題集を読み込んでください。");
      }
    }catch(err){
      alert("JSONの読み込みに失敗しました: " + err.message);
    }finally{
      e.target.value = "";
    }
  });
  resetQuestionsBtn.addEventListener("click", ()=>{
    localStorage.removeItem(KEY.CUSTOM);
    customQuestions = null;
    index = 0;
    render();
  });

  render();
});
