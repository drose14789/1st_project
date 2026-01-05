const params = new URLSearchParams(location.search);
const gu = params.get("gu") || "미지정";

// 제목
document.getElementById("title").textContent = `${gu} 업태별 3년 이내 폐업률 예측`;

/* =========================
   ✅ 구별 이미지 자동 표시 (폴더: gu_barplots)
   - 네 파일명: "{구}_업태별_폐업률.png" 우선
   ========================= */
const imgEl = document.getElementById("guImage");
if (imgEl) {
  imgEl.alt = `${gu} 업태별 폐업률 그래프`;

  const candidates = [
    // ✅ 네 파일명(최우선)
    `./gu_barplots/${gu}_업태별_폐업률.png`,
    `./gu_barplots/${gu}_업태별_폐업률.jpg`,

    // (안전장치) 혹시 다른 이름도 있을 수 있으니 남겨둠
    `./gu_barplots/${gu}.png`,
    `./gu_barplots/${gu}.jpg`,
    `./gu_barplots/${gu}_barplots.png`,
    `./gu_barplots/${gu}_barplots.jpg`,
    `./gu_barplots/${gu}-barplots.png`,
    `./gu_barplots/${gu}-barplots.jpg`,
  ];

  let idx = 0;
  const tryNext = () => {
    if (idx >= candidates.length) {
      imgEl.style.display = "none"; // 이미지 없으면 숨김
      return;
    }
    imgEl.src = candidates[idx++];
  };

  imgEl.onerror = tryNext;
  tryNext();
}

/* =========================
   ✅ 업태별 폐업 데이터 로드
   ========================= */
fetch("./close_by_gu_biz.json")
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  })
  .then(data => {
    const rows = data
      .filter(d => d.gu === gu)
      .sort((a, b) => (b.close_rate - a.close_rate));

    renderTable(rows);
    renderBar(rows);
  })
  .catch(err => {
    console.error(err);
    document.getElementById("tableWrap").innerHTML =
      "데이터 로드 실패 (Live Server로 실행했는지 / 파일 경로 확인)";
  });

function renderTable(rows) {
  if (!rows.length) {
    document.getElementById("tableWrap").innerHTML = "해당 구 데이터가 없습니다.";
    return;
  }

  const html = `
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:10px;border-bottom:1px solid #d8e6ff;">업태</th>
          <th style="text-align:right;padding:10px;border-bottom:1px solid #d8e6ff;">폐업률(%)</th>
          <th style="text-align:right;padding:10px;border-bottom:1px solid #d8e6ff;">표본수(n)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #eef5ff;">${r.biz}</td>
            <td style="padding:10px;text-align:right;border-bottom:1px solid #eef5ff;">${(r.close_rate*100).toFixed(1)}</td>
            <td style="padding:10px;text-align:right;border-bottom:1px solid #eef5ff;">${r.n ?? "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  document.getElementById("tableWrap").innerHTML = html;
}

function renderBar(rows) {
  const svg = d3.select("#bar");
  svg.selectAll("*").remove();

  if (!rows.length) return;

  const margin = { top: 20, right: 20, bottom: 120, left: 60 };
  const width = +svg.attr("width") - margin.left - margin.right;
  const height = +svg.attr("height") - margin.top - margin.bottom;

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(rows.map(d => d.biz))
    .range([0, width])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(rows, d => d.close_rate) || 0])
    .nice()
    .range([height, 0]);

  g.append("g").call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(".0%")));
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-35)")
    .style("text-anchor", "end");

  g.selectAll("rect")
    .data(rows)
    .enter()
    .append("rect")
    .attr("x", d => x(d.biz))
    .attr("y", d => y(d.close_rate))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.close_rate));
}
