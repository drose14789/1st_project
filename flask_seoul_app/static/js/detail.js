(() => {
  const params = new URLSearchParams(location.search);
  const gu = (window.GU || params.get("gu") || "미지정").toString().trim();
  const norm = (s) => (s ?? "").toString().trim().replace(/\s+/g, "");
  document.title = `${gu} 업태별 상세정보`;

  // ---- 이미지
  const imgEl = document.getElementById("guImage");
  const msgEl = document.getElementById("imgFallbackMsg");

  function showNoImageMsg() {
    if (imgEl) imgEl.style.display = "none";
    if (msgEl) msgEl.style.display = "block";
  }
  function showImage(src) {
    if (!imgEl) return;
    imgEl.style.display = "block";
    if (msgEl) msgEl.style.display = "none";
    imgEl.src = src;
  }

  if (window.PLOT_URL) {
    showImage(window.PLOT_URL);
  } else {
    const base = window.BARPLOT_BASE || "/static/gu_barplots/";
    const candidates = [
      `${base}${gu}_업태별_폐업률.png`,
      `${base}${gu}.png`,
      `${base}${gu}.jpg`,
      `${base}${gu}.jpeg`,
      `${base}${gu}.webp`,
    ];
    if (imgEl) {
      let idx = 0;
      const tryNext = () => {
        if (idx >= candidates.length) return showNoImageMsg();
        imgEl.src = candidates[idx++];
      };
      imgEl.onerror = tryNext;
      tryNext();
    }
  }

  // ---- 데이터
  const JSON_URL = window.CLOSE_DATA_URL || "/static/data/close_by_gu_biz.json";
  const tableWrap = document.getElementById("tableWrap");
  const barSvgEl = document.getElementById("bar");
  const scatterSvgEl = document.getElementById("scatter");

  let cachedRows = [];

  function pickRatePct(d) {
    if (d.close_rate_pct != null && Number.isFinite(+d.close_rate_pct)) return +d.close_rate_pct;
    const v =
      (d.close_rate != null && Number.isFinite(+d.close_rate)) ? +d.close_rate :
      (d.true_rate != null && Number.isFinite(+d.true_rate)) ? +d.true_rate :
      (d.pred_rate != null && Number.isFinite(+d.pred_rate)) ? +d.pred_rate : 0;
    return (v <= 1.5) ? v * 100 : v;
  }
  function pickCount(d) { return d.n ?? d.count ?? d.점포수 ?? null; }
  function pickBiz(d) { return (d.biz ?? d.업태_그룹 ?? d.biz_group ?? "미지정").toString().trim(); }

  function renderTable(rows) {
    if (!tableWrap) return;
    if (!rows.length) {
      tableWrap.innerHTML = `<div style="padding:12px;">데이터가 없습니다: ${gu}</div>`;
      return;
    }

    // ✅ 한 화면용: 표는 전체 행 보여주되 내부 스크롤
    const html = `
      <table style="width:100%; border-collapse:collapse; font-size:13.5px;">
        <thead>
          <tr>
            <th style="position:sticky;top:0;background:#fff;padding:10px;border-bottom:1px solid rgba(0,0,0,0.08);text-align:left;">업태</th>
            <th style="position:sticky;top:0;background:#fff;padding:10px;border-bottom:1px solid rgba(0,0,0,0.08);text-align:right;">폐업률(%)</th>
            <th style="position:sticky;top:0;background:#fff;padding:10px;border-bottom:1px solid rgba(0,0,0,0.08);text-align:right;">점포수</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="padding:9px 10px;border-bottom:1px solid rgba(0,0,0,0.06);">${r.biz}</td>
              <td style="padding:9px 10px;border-bottom:1px solid rgba(0,0,0,0.06);text-align:right;font-variant-numeric:tabular-nums;">${r.ratePct.toFixed(1)}</td>
              <td style="padding:9px 10px;border-bottom:1px solid rgba(0,0,0,0.06);text-align:right;font-variant-numeric:tabular-nums;">${r.n ?? "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    tableWrap.innerHTML = html;
  }

  function getSvgBox(svgEl, fallbackW=900, fallbackH=420){
    const rect = svgEl?.getBoundingClientRect();
    const w = rect?.width ? Math.floor(rect.width) : fallbackW;
    const h = rect?.height ? Math.floor(rect.height) : fallbackH;
    return { w: Math.max(320, w), h: Math.max(220, h) };
  }

  // ✅ 막대: 카드 크기에 맞춰 그리기 + 라벨 안 잘림
  function renderBar(rows) {
    if (!barSvgEl) return;
    const svg = d3.select(barSvgEl);
    svg.selectAll("*").remove();
    if (!rows.length) return;

    const top = rows.slice(0, 10); // ✅ 한 화면용: 10개만(가독성)

    const { w: width, h: height } = getSvgBox(barSvgEl, 980, 360);

    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("preserveAspectRatio", "xMidYMid meet");

    const margin = { top: 14, right: 120, bottom: 40, left: 190 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const x = d3.scaleLinear()
      .domain([0, d3.max(top, d => d.ratePct) || 0])
      .nice()
      .range([0, innerW]);

    const y = d3.scaleBand()
      .domain(top.map(d => d.biz))
      .range([0, innerH])
      .padding(0.12);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(gg => gg.selectAll("text").style("font-size", "11.5px"));

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5))
      .call(gg => gg.selectAll("text").style("font-size", "11.5px"));

    g.selectAll("rect")
      .data(top)
      .join("rect")
      .attr("x", 0)
      .attr("y", d => y(d.biz))
      .attr("height", y.bandwidth())
      .attr("width", d => x(d.ratePct))
      .attr("rx", 8)
      .attr("fill", "rgba(30, 136, 229, 0.75)");

    const SAFE_PAD = 52;
    g.selectAll("text.value")
      .data(top)
      .join("text")
      .attr("x", d => {
        const w = x(d.ratePct);
        return (w > innerW - SAFE_PAD) ? (w - 8) : (w + 8);
      })
      .attr("y", d => y(d.biz) + y.bandwidth() / 2)
      .attr("text-anchor", d => (x(d.ratePct) > innerW - SAFE_PAD) ? "end" : "start")
      .attr("dominant-baseline", "middle")
      .style("font-size", "11.5px")
      .style("font-weight", "900")
      .style("fill", d => (x(d.ratePct) > innerW - SAFE_PAD) ? "white" : "#0f172a")
      .text(d => `${d.ratePct.toFixed(1)}%`);
  }

  // ✅ 산점도: 카드 크기에 맞춰 그리기
  function renderScatter(rows) {
    if (!scatterSvgEl) return;
    const svg = d3.select(scatterSvgEl);
    svg.selectAll("*").remove();

    const pts = rows
      .filter(d => d.n != null && Number.isFinite(+d.n) && Number.isFinite(+d.ratePct))
      .map(d => ({
        biz: d.biz,
        n: +d.n,
        ratePct: +d.ratePct,
        expClose: (+d.n) * (+d.ratePct) / 100,
      }));

    if (!pts.length) {
      svg.append("text").attr("x", 18).attr("y", 28).text("점포수(n) 데이터가 없습니다.");
      return;
    }

    const { w: width, h: height } = getSvgBox(scatterSvgEl, 980, 420);
    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("preserveAspectRatio", "xMidYMid meet");

    const margin = { top: 16, right: 18, bottom: 42, left: 58 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const xMax = d3.max(pts, d => d.n) || 0;
    const yMax = d3.max(pts, d => d.ratePct) || 0;

    const x = d3.scaleLinear().domain([0, xMax]).range([0, innerW]).nice();
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();
    const r = d3.scaleSqrt().domain([0, d3.max(pts, d => d.expClose) || 1]).range([4, 22]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(5))
      .call(gg => gg.selectAll("text").style("font-size", "11.5px"));
    g.append("g").call(d3.axisLeft(y).ticks(5))
      .call(gg => gg.selectAll("text").style("font-size", "11.5px"));

    // tooltip
    let tip = d3.select("#scatterTip");
    if (tip.empty()) {
      tip = d3.select("body")
        .append("div")
        .attr("id", "scatterTip")
        .style("position", "fixed")
        .style("z-index", "9999")
        .style("pointer-events", "none")
        .style("padding", "10px 12px")
        .style("border-radius", "12px")
        .style("background", "rgba(255,255,255,0.96)")
        .style("border", "1px solid rgba(0,0,0,0.12)")
        .style("box-shadow", "0 8px 24px rgba(0,0,0,0.12)")
        .style("font-size", "12.5px")
        .style("display", "none");
    }

    g.selectAll("circle.point")
      .data(pts)
      .join("circle")
      .attr("class", "point")
      .attr("cx", d => x(d.n))
      .attr("cy", d => y(d.ratePct))
      .attr("r", d => r(d.expClose))
      .attr("fill", "rgba(244, 67, 54, 0.62)")
      .attr("stroke", "rgba(0,0,0,0.32)")
      .attr("stroke-width", 1)
      .on("mousemove", (event, d) => {
        tip.style("display", "block")
          .style("left", (event.clientX + 14) + "px")
          .style("top", (event.clientY + 14) + "px")
          .html(`
            <div style="font-weight:900; margin-bottom:6px;">${d.biz}</div>
            <div>점포수(n): <b>${d.n.toLocaleString()}</b></div>
            <div>폐업률(%): <b>${d.ratePct.toFixed(1)}</b></div>
            <div>예상 폐업건수: <b>${d.expClose.toFixed(1)}</b></div>
          `);
      })
      .on("mouseleave", () => tip.style("display", "none"));
  }

  function renderAll() {
    renderTable(cachedRows);
    // 레이아웃이 잡힌 다음 그리기
    requestAnimationFrame(() => {
      renderBar(cachedRows);
      renderScatter(cachedRows);
    });
  }

  fetch(JSON_URL)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(raw => {
      cachedRows = (raw || [])
        .filter(d => norm(d.gu) === norm(gu))
        .map(d => ({ gu: d.gu, biz: pickBiz(d), ratePct: pickRatePct(d), n: pickCount(d) }))
        .filter(d => Number.isFinite(d.ratePct))
        .sort((a,b) => b.ratePct - a.ratePct);

      renderAll();
    })
    .catch(err => {
      console.error(err);
      if (tableWrap) tableWrap.innerHTML = "데이터 로드 실패(경로 확인)";
    });

  // 창 크기 바뀌면 차트만 다시 그리기
  let t = null;
  window.addEventListener("resize", () => {
    if (!cachedRows.length) return;
    clearTimeout(t);
    t = setTimeout(() => {
      renderBar(cachedRows);
      renderScatter(cachedRows);
    }, 120);
  });
})();
