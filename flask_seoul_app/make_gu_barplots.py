import os, json
import pandas as pd
import matplotlib.pyplot as plt

# ✅ Windows 한글 폰트(필요하면 바꿔도 됨)
plt.rcParams["font.family"] = "Malgun Gothic"
plt.rcParams["axes.unicode_minus"] = False

DATA_PATH = "static/data/close_by_gu_biz.json"   # detail.js가 읽는 것과 동일
OUT_DIR   = "static/gu_barplots"
os.makedirs(OUT_DIR, exist_ok=True)

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

df = pd.DataFrame(data)

# --- 폐업률(%) 컬럼 만들기(스키마 호환)
if "close_rate_pct" in df.columns:
    df["rate_pct"] = pd.to_numeric(df["close_rate_pct"], errors="coerce")
elif "close_rate" in df.columns:
    v = pd.to_numeric(df["close_rate"], errors="coerce")
    df["rate_pct"] = v.where(v > 1.5, v * 100)   # 0~1이면 % 변환
elif "true_rate" in df.columns:
    df["rate_pct"] = pd.to_numeric(df["true_rate"], errors="coerce") * 100
else:
    raise ValueError("폐업률 컬럼(close_rate_pct/close_rate/true_rate)이 없습니다.")

# --- 점포수 n
if "n" not in df.columns:
    df["n"] = pd.NA
df["n"] = pd.to_numeric(df["n"], errors="coerce")

# --- 구별 이미지 생성 (top7 업태)
for gu, g in df.groupby("gu"):
    g = g.dropna(subset=["rate_pct"]).copy()
    if g.empty:
        continue

    g = g.sort_values("rate_pct", ascending=False).head(7)
    biz = g["biz"].astype(str).tolist()
    rate = g["rate_pct"].astype(float).tolist()

    plt.figure(figsize=(5.6, 3.6))
    bars = plt.bar(range(len(biz)), rate)
    plt.xticks(range(len(biz)), biz, rotation=25, ha="right")
    plt.ylim(0, max(rate) * 1.15)
    # plt.title(f"{gu}")
    plt.ylabel("폐업률(%)")

    # 값 라벨: ✅ 소수점 1자리(표랑 맞춤)
    for i, v in enumerate(rate):
        plt.text(i, v + (max(rate) * 0.02), f"{v:.1f}%", ha="center", va="bottom", fontsize=9)

    out_path = os.path.join(OUT_DIR, f"{gu}_업태별_폐업률.png")
    plt.tight_layout()
    plt.savefig(out_path, dpi=200)
    plt.close()

print("DONE:", OUT_DIR)
