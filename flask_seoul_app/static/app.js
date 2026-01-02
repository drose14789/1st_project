let selectedGu = null;

const svg = d3.select("#seoulMap");

// ✅ 너 HTML에 맞는 id로 변경
const selectedGuEl = document.getElementById("selectedGu"); // <b id="selectedGu">
const guInputEl = document.getElementById("guInput");       // <input id="guInput">
const bizEl = document.getElementById("bizSelect");
const monthEl = document.getElementById("monthSelect");
const pyeongEl = document.getElementById("pyeongSelect");
const btnEl = document.getElementById("runBtn");            // <button id="runBtn">
const resultBox = document.getElementById("resultBox");
const errBox = document.getElementById("errBox");
const overlay = document.getElementById("loadingOverlay");

const W = 800, H = 650;

function setSelectedGuText(gu) {
  if (selectedGuEl) selectedGuEl.textContent = gu || "없음";
  if (guInputEl) guInputEl.value = gu || "";
}

function setError(msg) {
  if (errBox) errBox.innerHTML = msg ? `<div style="color:#dc2626;font-weight:800;">${msg}</div>` : "";
}

function setResult(html) {
  if (resultBox) resultBox.innerHTML = html;
}

function showOverlay(on) {
  if (!overlay) return;
  overlay.style.display = on ? "flex" : "none";
}

// GeoJSON 구 이름 최대한 잡기
function getGuName(feature) {
  const p = (feature && feature.properties) ? feature.properties : {};
  const v = p.SIG_KOR_NM || p.name || p.adm_nm || p.gu || p.GU_NM || p.ADM_NM || p.sggnm;
  if (v) return String(v).trim();

  // 마지막 fallback: 문자열 값 아무거나
  for (const k of Object.keys(p)) {
    const val = p[k];
    if (typeof val === "string" && val.trim().length >= 2) return val.trim();
  }
  return "알수없음";
}

async function loadGeoAndRender() {
  try {
    setError("");
    showOverlay(false); // ✅ 시작할 때 overlay 무조건 꺼두기

    const res = await fetch("/api/seoul-geojson");
    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || "GeoJSON 응답 오류");

    const geo = j.geo;

    const projection = d3.geoMercator().fitSize([W, H], geo);
    const path = d3.geoPath().projection(projection);

    svg.attr("viewBox", `0 0 ${W} ${H}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    svg.selectAll("*").remove();

    const g = svg.append("g").attr("class", "gu-layer");

    // ✅ path 그리기 + 클릭
    g.selectAll("path.gu")
      .data(geo.features)
      .enter()
      .append("path")
      .attr("class", "gu")
      .attr("d", path)
      .style("pointer-events", "all")
      .on("click", function (event, d) {
        event.preventDefault();
        event.stopPropagation();

        selectedGu = getGuName(d);

        g.selectAll("path.gu").classed("selected", false);
        d3.select(this).classed("selected", true);

        setSelectedGuText(selectedGu);
        setError("");
      });

    // ✅ 구 이름 라벨 표시 (텍스트가 클릭 가로채지 않게 pointer-events none은 CSS에서 처리)
    g.selectAll("text.gu-label")
      .data(geo.features)
      .enter()
      .append("text")
      .attr("class", "gu-label")
      .attr("transform", (d) => {
        const c = path.centroid(d);
        return `translate(${c[0]},${c[1]})`;
      })
      .attr("text-anchor", "middle")
      .text((d) => getGuName(d).replace("서울특별시 ", ""));

    // 디버그: path 개수 확인
    console.log("✅ paths:", document.querySelectorAll("#seoulMap path.gu").length);

    setSelectedGuText(null);

  } catch (e) {
    console.error(e);
    setError(`지도 로드 오류: ${e.message}`);
  }
}

async function requestPredict() {
  try {
    setError("");

    if (!selectedGu) {
      setError("구를 먼저 선택하세요.");
      return;
    }

    const biz = bizEl ? bizEl.value : "";
    const month = monthEl ? parseInt(monthEl.value || "1", 10) : 1;
    const pyeong = pyeongEl ? parseInt(pyeongEl.value || "10", 10) : 10;

    if (!biz) {
      setError("업태를 선택하세요.");
      return;
    }

    showOverlay(true);
    btnEl && (btnEl.disabled = true);

    const payload = { gu: selectedGu, biz, month, pyeong };

    const res = await fetch("/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await res.json();
    if (!res.ok || !j.ok) throw new Error(j.error || `서버 오류(${res.status})`);

    // 서버가 risk_pct/grade/label/result 내려주는 버전 기준
    const risk = j.risk_pct ?? j.probability ?? null;
    const grade = j.grade ?? "";
    const label = j.label ?? "";

    setResult(`
      <div class="result-title">3) 결과</div>
      <div style="margin-top:8px; font-size:20px; font-weight:900;">
        ${j.result ?? `폐업 위험도 ${risk}%`}
      </div>
      <div style="margin-top:6px; opacity:.85;">
        등급: <b>${grade}</b> ${label ? `/ 라벨: <b>${label}</b>` : ""}
      </div>
      <div style="margin-top:10px; font-size:12px; opacity:.75;">
        입력: ${j.inputs.gu} / ${j.inputs.biz} / ${j.inputs.month}월 / ${j.inputs.pyeong}평
      </div>
    `);

  } catch (e) {
    console.error(e);
    setError(`서버 통신 오류: ${e.message}`);
  } finally {
    showOverlay(false);
    btnEl && (btnEl.disabled = false);
  }
}

// ✅ 버튼 id가 runBtn이니까 여기에 연결
if (btnEl) btnEl.addEventListener("click", requestPredict);

loadGeoAndRender();
