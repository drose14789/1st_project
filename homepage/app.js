/* =========================
   기본 설정
   ========================= */
let selectedGu = null;

const W = 800;
const H = 600;

// SVG + viewBox
const svg = d3.select("#seoulMap")
  .attr("viewBox", `0 0 ${W} ${H}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

// 상단 선택 텍스트
const labelEl = document.getElementById("selectedLabel");

/* =========================
   GeoJSON 로드
   ========================= */
d3.json("./seoul_municipalities_geo.json").then((geo) => {

  /* =========================
     projection 설정
     ========================= */
  const projection = d3.geoMercator()
    .fitExtent(
      [[100, 40], [W - 100, H - 180]],   // 지도 위치/크기 제어
      geo
    );

  const path = d3.geoPath().projection(projection);

  /* =========================
     구 이름 안전 추출
     ========================= */
  const getGuName = (d) => {
    const p = d.properties || {};
    return (
      p.name ||
      p.SIG_KOR_NM ||
      p.adm_nm ||
      p.gu ||
      p.GU ||
      "이름없음"
    );
  };

  /* =========================
     1️⃣ 지도 path 그리기
     ========================= */
  const paths = svg.selectAll("path.gu")
    .data(geo.features)
    .enter()
    .append("path")
    .attr("class", "gu")
    .attr("d", path);

  /* =========================
     2️⃣ 지도 안 글씨(구 이름) 추가
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
      // 너무 작은 구는 글씨 숨김 (겹침 방지)
      return path.area(d) > 1500 ? getGuName(d) : "";
    });

  /* =========================
     3️⃣ 클릭 이벤트 (path + label 연동)
     ========================= */
  paths.on("click", function (event, d) {
    // 선택 초기화
    svg.selectAll(".gu").classed("selected", false);
    svg.selectAll(".gu-label").classed("selected", false);

    // 현재 선택
    d3.select(this).classed("selected", true);

    // 해당 구 라벨 강조
    labels
      .filter(l => l === d)
      .classed("selected", true);

    selectedGu = getGuName(d);
    labelEl.textContent = selectedGu;
  });

}).catch(err => {
  console.error("GeoJSON 로드 실패:", err);
  alert("GeoJSON 파일을 불러오지 못했습니다.");
});
