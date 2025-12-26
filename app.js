/* =========================
   [JS 1] 상태/DOM
   ========================= */
let selectedGu = null;

const svg = d3.select("#seoulMap");
const labelEl = document.getElementById("selectedLabel");
const btnEl = document.getElementById("confirmBtn");

const W = 800, H = 600;

/* =========================
   [JS 2] GeoJSON 로드
   ✅ 파일명이 정확히 seoul-gu.geojson 인지 확인!
   ========================= */
d3.json("./seoul_municipalities_geo.json").then((geo) => {
  console.log("GeoJSON 로드 성공:", geo);

  /* =========================
     [JS 3] 구 이름 필드 자동 추출
     - GeoJSON마다 properties 키가 달라서 안전하게 처리
     ========================= */
  const getGuName = (d) => {
    const p = d.properties || {};
    return (
      p.name ||            // 가장 흔함
      p.SIG_KOR_NM ||      // 많이 나옴(시군구 한글명)
      p.adm_nm ||          // 어떤 데이터셋에서 사용
      p.EMD_KOR_NM ||      // (혹시 동 단위면 이게 뜰 수 있음)
      p.gu || p.GU ||
      "이름없음"
    );
  };

  /* =========================
     [JS 4] 렌더링(투영/패스)
     ========================= */
  const projection = d3.geoMercator().fitSize([W, H], geo);
  const geoPath = d3.geoPath().projection(projection);

  const paths = svg.selectAll("path")
    .data(geo.features)
    .enter()
    .append("path")
    .attr("class", "gu")
    .attr("data-gu", d => getGuName(d))
    .attr("d", geoPath);

  /* =========================
     [JS 5] hover 겹침 방지(맨 위로)
     ========================= */
  paths.on("mouseenter", function () {
    this.parentNode.appendChild(this);
  });

  /* =========================
     [JS 6] 클릭: 단일 선택 + 라벨/버튼
     ========================= */
  paths.on("click", function () {
    svg.selectAll(".gu").classed("selected", false);
    d3.select(this).classed("selected", true);

    selectedGu = this.getAttribute("data-gu");
    labelEl.textContent = selectedGu;
    btnEl.disabled = false;

    console.log("선택한 구:", selectedGu);
  });

}).catch((err) => {
  console.error("GeoJSON 로드 실패:", err);
  alert("GeoJSON 로드 실패! 파일명/위치/Live Server를 확인하세요.");
});

/* =========================
   [JS 7] 선택 완료 버튼 -> detail.html 이동
   ========================= */
btnEl.addEventListener("click", () => {
  if (!selectedGu) return alert("구를 먼저 선택하세요!");
  location.href = `detail.html?gu=${encodeURIComponent(selectedGu)}`;
});
