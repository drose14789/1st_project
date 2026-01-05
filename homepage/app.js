let selectedGu = null;

const W = 800;
const H = 600;

const svg = d3.select("#seoulMap")
  .attr("viewBox", `0 0 ${W} ${H}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

const labelEl = document.getElementById("selectedLabel");
const btnEl = document.getElementById("confirmBtn");
btnEl.disabled = true;

// ✅ 로딩 오버레이 + 딜레이 설정
const overlayEl = document.getElementById("loadingOverlay");
const DELAY_MS = 3000; // ✅ 여기 숫자만 바꾸면 됨 (3000=3초, 5000=5초 등)

// 공통 선택 처리 함수
function selectGu(d, pathEl, labelElSel) {
  svg.selectAll(".gu").classed("selected", false);
  svg.selectAll(".gu-label").classed("selected", false);

  pathEl.classed("selected", true);
  labelElSel.classed("selected", true);

  selectedGu = getGuName(d);
  labelEl.textContent = selectedGu;
  btnEl.disabled = false;
}

// 구 이름 안전 추출
function getGuName(d) {
  const p = d.properties || {};
  return p.name || p.SIG_KOR_NM || p.gu || "이름없음";
}

// ✅ 로딩 띄우고 딜레이 후 detail로 이동
function goDetailWithLoading() {
  if (!selectedGu) return alert("구를 먼저 선택하세요!");

  // 오버레이가 있으면 보여주고, 없으면 그냥 이동
  if (overlayEl) overlayEl.style.display = "flex";

  // 오버레이가 화면에 실제로 그려진 다음 타이머 시작(체감상 더 확실)
  requestAnimationFrame(() => {
    setTimeout(() => {
      window.location.href = `detail.html?gu=${encodeURIComponent(selectedGu)}`;
    }, DELAY_MS);
  });
}

d3.json("./seoul_municipalities_geo.json")
  .then((geo) => {
    const projection = d3.geoMercator().fitSize([W, H], geo);
    const path = d3.geoPath().projection(projection);

    /* =========================
       1️⃣ 구 영역
       ========================= */
    const paths = svg.selectAll("path.gu")
      .data(geo.features)
      .enter()
      .append("path")
      .attr("class", "gu")
      .attr("d", path);

    /* =========================
       2️⃣ 구 이름 텍스트
       ========================= */
    const labels = svg.selectAll("text.gu-label")
      .data(geo.features)
      .enter()
      .append("text")
      .attr("class", "gu-label")
      .attr("x", d => path.centroid(d)[0])
      .attr("y", d => path.centroid(d)[1])
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .text(d => {
        // 너무 작은 구는 텍스트 숨김
        return path.area(d) > 1500 ? getGuName(d) : "";
      });

    /* =========================
       3️⃣ 클릭 이벤트 (구 영역)
       ========================= */
    paths.on("click", function (event, d) {
      const pathEl = d3.select(this);
      const labelElSel = labels.filter(l => l === d);
      selectGu(d, pathEl, labelElSel);
    });

    /* =========================
       4️⃣ 클릭 이벤트 (텍스트)
       ========================= */
    labels.on("click", function (event, d) {
      const labelElSel = d3.select(this);
      const pathEl = paths.filter(p => p === d);
      selectGu(d, pathEl, labelElSel);
    });

    /* =========================
       5️⃣ 버튼 이동 (✅ 여기만 수정됨: 즉시 이동 -> 로딩+딜레이)
       ========================= */
    btnEl.addEventListener("click", goDetailWithLoading);
  })
  .catch(err => {
    console.error("GeoJSON 로드 실패:", err);
    alert("지도 데이터를 불러오지 못했습니다.");
  });