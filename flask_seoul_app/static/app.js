let selectedGu = null;


const LABEL_OFFSET = {
  "강남구": [-10, 10],
  "서초구": [-10, 0],
  "중구": [0, 0],    // 좌우 조정
  "양천구": [0, 10], // 위아래 조정
  "구로구": [-10, 0],
  "종로구": [-7, 15],
  "서대문구": [-8, 0],
  "성북구": [0, 10],
  "강북구": [0, 10],

};



const svg = d3.select("#seoulMap");

const selectedGuEl = document.getElementById("selectedGu");
const guInputEl = document.getElementById("guInput");
const bizEl = document.getElementById("bizSelect");
const monthEl = document.getElementById("monthSelect");
const pyeongEl = document.getElementById("pyeongSelect");
const btnEl = document.getElementById("runBtn");
const resultBox = document.getElementById("resultBox");
const errBox = document.getElementById("errBox");
const overlay = document.getElementById("loadingOverlay");

const W = 800, H = 650;

function setSelectedGuText(gu) {
  if (selectedGuEl) selectedGuEl.textContent = gu || "없음";
  if (guInputEl) guInputEl.value = gu || "";
}

function showError(msg) {
  if (!errBox) return;
  errBox.textContent = msg || "";
  errBox.style.display = msg ? "block" : "none";
}

function showOverlay(on) {
  if (!overlay) return;
  overlay.style.display = on ? "flex" : "none";
}

function renderResult(data) {
  if (!resultBox) return;

  const pillRow = document.getElementById("pillRow");
  const predText = document.getElementById("predText");

  if (pillRow) pillRow.innerHTML = "";
  if (predText) predText.textContent = "";

  if (!data || !data.ok) {
    showError(data?.error || "예측 실패");
    return;
  }

  showError("");

  const pills = [];
  if (data.gu) pills.push(`구: ${data.gu}`);
  if (data.biz) pills.push(`업태: ${data.biz}`);
  if (data.month) pills.push(`월: ${data.month}`);
  if (data.pyeong) pills.push(`평수: ${data.pyeong}`);

  if (pillRow) {
    pills.forEach((t) => {
      const div = document.createElement("div");
      div.className = "pill";
      div.textContent = t;
      pillRow.appendChild(div);
    });
  }

  if (predText) {
    const prob = (data.pred_prob ?? data.prob ?? null);
    const label = (data.label ?? data.result ?? "");
    const grade = (data.grade ?? "");

    let line = "";
    if (prob !== null && prob !== undefined) line += `예측확률: ${(Number(prob) * 100).toFixed(1)}%  `;
    if (label) line += `판정: ${label}  `;
    if (grade) line += `등급: ${grade}`;

    predText.textContent = line || JSON.stringify(data);
  }

  resultBox.style.display = "block";
}

function getGuName(d) {
  const p = d.properties || {};
  return p.name || p.SIG_KOR_NM || p.adm_nm || p.gu || p.GU || p.SGG_NM || "";
}

function onGuClick(event, d) {
  const gu = getGuName(d);
  if (!gu) return;

  selectedGu = gu;
  setSelectedGuText(gu);

  svg.selectAll("path.gu")
    .classed("selected", (x) => getGuName(x) === gu);
}

async function loadGeoAndRender() {
  try {
    const res = await fetch("/api/seoul-geojson", { cache: "no-store" });
    const raw = await res.json();

    // ✅ 서버가 원본을 주면 raw가 FeatureCollection
    // ✅ 서버가 감싸서 주면 {ok:true, geo: FeatureCollection}
    const geo = (raw && raw.type === "FeatureCollection") ? raw : (raw.geo || null);

    if (!geo || !geo.features) {
      console.error("GeoJSON 응답 형식 오류:", raw);
      return showError("GeoJSON 로드 실패(응답 형식 오류)");
    }

    const projection = d3.geoMercator().fitSize([W, H], geo);
    const path = d3.geoPath().projection(projection);

    svg.selectAll("*").remove();

    svg.selectAll("path.gu")
      .data(geo.features)
      .enter()
      .append("path")
      .attr("class", "gu")
      .attr("d", path)
      .on("click", onGuClick);

    svg.selectAll("text.gu-label")
      .data(geo.features)
      .enter()
      .append("text")
      .attr("class", "gu-label")
      .attr("transform", (d) => {
        const name = getGuName(d);
        const [x, y] = path.centroid(d);
        const [dx, dy] = (LABEL_OFFSET && LABEL_OFFSET[name]) ? LABEL_OFFSET[name] : [0, 0];
        return `translate(${x + dx},${y + dy})`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text((d) => getGuName(d));

  } catch (e) {
    console.error(e);
    showError("GeoJSON 로드 실패");
  }
}

async function requestPredict() {
  try {
    showError("");

    const gu = selectedGu || (guInputEl ? guInputEl.value.trim() : "");
    const biz = bizEl ? bizEl.value : "";
    const month = monthEl ? parseInt(monthEl.value || "1", 10) : 1;
    const pyeong = pyeongEl ? parseInt(pyeongEl.value || "10", 10) : 10;

    if (!gu) return showError("구를 선택하세요.");
    if (!biz) return showError("업태를 선택하세요.");

    showOverlay(true);

    const payload = { gu, biz, month, pyeong };

    const res = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    renderResult(data);

  } catch (e) {
    console.error(e);
    showError("예측 요청 실패");
  } finally {
    showOverlay(false);
  }
}

if (btnEl) btnEl.addEventListener("click", requestPredict);

loadGeoAndRender();


// ============================================================
// ✅ 모델 기준/출처(근거) 표시: /model-info 응답을 화면에 출력
//    - 404/HTML 응답도 안전하게 처리
// ============================================================
async function loadModelInfo() {
  const box = document.getElementById("modelInfoBox");
  if (!box) return;

  try {
    const res = await fetch("/model-info", { cache: "no-store" });

    const text = await res.text();
    let j = null;
    try { j = JSON.parse(text); } catch {}

    if (!res.ok) {
      const msg = (j && j.error) ? j.error : `/model-info HTTP ${res.status}`;
      throw new Error(msg);
    }
    if (!j || !j.ok) {
      throw new Error(j?.error || "모델 정보 응답 형식 오류");
    }

    const d = j.defaults_latest || {};
    const baseRate = (d.base_rate ?? "-");
    const partRate = (d["인허가일자_경제활동참가율"] ?? "-");
    const unemp = (d["인허가일자_실업률"] ?? "-");
    const emp = (d["인허가일자_고용률"] ?? "-");

    box.innerHTML = `


      <div style="margin-bottom:6px;"><b>경제지표 기본값</b></div>
      <div>· base_rate: <b>${baseRate}</b></div>
      <div>· 경제활동참가율: <b>${partRate}</b></div>
      <div>· 실업률: <b>${unemp}</b></div>
      <div>· 고용률: <b>${emp}</b></div>
    `;
  } catch (e) {
    box.innerHTML = `<div style="color:#dc2626;font-weight:900;">모델 정보 로드 실패: ${e.message}</div>`;
  }
}

loadModelInfo();
