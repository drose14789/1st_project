// static/js/app.js
(() => {
  let selectedGu = null;

  const svg = d3.select("#seoulMap");
  const labelEl = document.getElementById("selectedLabel");
  const btnEl = document.getElementById("confirmBtn");

  const W = 800, H = 600;
  svg.attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");

  if (btnEl) btnEl.disabled = true;

  const norm = (s) => (s ?? "").toString().trim().replace(/\s+/g, "");

  const GEO_URLS = [
    window.GEOJSON_URL,
    "/static/data/seoul_municipalities_geo.json",
    "./seoul_municipalities_geo.json",
  ].filter(Boolean);

  const RATE_URLS = [
    window.GU_RATE_URL,
    "/static/data/gu_rate.csv",
    "./gu_rate.csv",
  ].filter(Boolean);

  async function tryD3Json(urls) {
    for (const u of urls) {
      try {
        return await d3.json(u);
      } catch (e) {
        console.warn("GeoJSON load failed:", u, e);
      }
    }
    throw new Error("GeoJSON 로드 실패: 경로 확인 필요");
  }

  async function tryD3Csv(urls) {
    for (const u of urls) {
      try {
        return await d3.csv(u, d3.autoType);
      } catch (e) {
        console.warn("CSV load failed:", u, e);
      }
    }
    return null; // 없어도 지도는 그리게 함
  }

  function getGuName(feature) {
    const p = feature?.properties || {};
    return (
      p.name ||
      p.SIG_KOR_NM ||
      p.adm_nm ||
      p.EMD_KOR_NM ||
      p.gu ||
      p.GU ||
      "이름없음"
    ).toString().trim();
  }

  function makeColorScale(values) {
    // 분위수 5단계(공통 구분점)
    const colors = ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"];
    return d3.scaleQuantile().domain(values).range(colors);
  }

  (async () => {
    const [geo, rateRows] = await Promise.all([
      tryD3Json(GEO_URLS),
      tryD3Csv(RATE_URLS),
    ]);

    const features = geo?.features || [];
    const projection = d3.geoMercator().fitSize([W, H], geo);
    const geoPath = d3.geoPath().projection(projection);

    // 구별 대표 폐업률 Map(있으면 색칠)
    let rateMap = null;
    let color = null;

    if (rateRows && rateRows.length) {
      rateMap = new Map(
        rateRows.map((r) => [norm(r["구"]), +r["폐업률_wavg_pct"]])
      );
      const values = [...rateMap.values()].filter((v) => Number.isFinite(v));
      if (values.length) color = makeColorScale(values);
    }

    // 레이어 그룹
    svg.selectAll("*").remove();
    const g = svg.append("g").attr("class", "map-layer");

    // 구 폴리곤
    const paths = g
      .selectAll("path.gu")
      .data(features)
      .join("path")
      .attr("class", "gu")
      .attr("data-gu", (d) => getGuName(d))
      .attr("d", geoPath)
      .attr("fill", (d) => {
        if (!rateMap || !color) return null; // CSS 기본 fill 사용
        const v = rateMap.get(norm(getGuName(d)));
        return Number.isFinite(v) ? color(v) : "#ddd";
      });

    // 클릭 이벤트
    paths.on("click", function () {
      g.selectAll("path.gu").classed("selected", false);
      d3.select(this).classed("selected", true);

      selectedGu = this.getAttribute("data-gu");
      if (labelEl) labelEl.textContent = selectedGu;
      if (btnEl) btnEl.disabled = false;
    });

    // ✅ 구 이름 라벨(사라진 거 복구)
    const labelLayer = g.append("g").attr("class", "gu-label-layer");

    labelLayer
      .selectAll("text")
      .data(features)
      .join("text")
      .attr("x", (d) => geoPath.centroid(d)[0])
      .attr("y", (d) => geoPath.centroid(d)[1])
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("pointer-events", "none") // 글씨가 클릭 막지 않게
      .style("user-select", "none")
      .style("font-size", "12px")
      .style("font-weight", "800")
      .attr("fill", "#111")
      .attr("stroke", "#fff")
      .attr("stroke-width", 3)
      .attr("paint-order", "stroke")
      .text((d) => getGuName(d));

    // 버튼 이동(Flask 라우트)
    if (btnEl) {
      btnEl.addEventListener("click", () => {
        if (!selectedGu) return alert("구를 먼저 선택하세요!");
        const base = window.DETAIL_URL_BASE || "/detail";
        location.href = `${base}?gu=${encodeURIComponent(selectedGu)}`;
      });
    }
  })().catch((err) => {
    console.error(err);
    alert("지도 로드 실패: GeoJSON/CSV 경로를 확인하세요.");
  });
})();
