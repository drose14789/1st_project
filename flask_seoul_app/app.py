from flask import Flask, render_template, request, url_for
import os

app = Flask(__name__)

def _norm(s: str) -> str:
    return (s or "").strip().replace(" ", "")

def find_gu_plot_filename(static_folder: str, gu: str):
    """
    static/gu_barplots 폴더에서 'gu'가 파일명에 포함된 이미지를 찾아 반환.
    - 우선순위: (1) 파일명이 gu로 시작 (2) 파일명에 gu 포함
    - 확장자 우선: png > jpg/jpeg > webp
    """
    plot_dir = os.path.join(static_folder, "gu_barplots")
    if not os.path.isdir(plot_dir):
        return None

    gu_n = _norm(gu)
    exts = [".png", ".jpg", ".jpeg", ".webp"]

    files = [f for f in os.listdir(plot_dir)
             if os.path.isfile(os.path.join(plot_dir, f))
             and os.path.splitext(f)[1].lower() in exts]

    if not files:
        return None

    def score(fname: str):
        base = os.path.splitext(fname)[0]
        base_n = _norm(base)
        ext = os.path.splitext(fname)[1].lower()

        ext_rank = {".png": 0, ".jpg": 1, ".jpeg": 1, ".webp": 2}.get(ext, 9)
        starts = 0 if base_n.startswith(gu_n) else 1
        contains = 0 if gu_n in base_n else 1

        # starts(0이 더 좋음) → contains(0이 더 좋음) → ext_rank(0이 더 좋음) → 파일명 길이(짧을수록 좋음)
        return (contains, starts, ext_rank, len(base_n))

    # 1) gu 포함 파일들만 우선 필터
    candidates = [f for f in files if gu_n in _norm(os.path.splitext(f)[0])]
    if not candidates:
        return None

    candidates.sort(key=score)
    return candidates[0]

@app.route("/")
def index():
    return render_template("mainpage.html")

@app.route("/detail")
def detail():
    gu = request.args.get("gu", "미지정")

    fname = find_gu_plot_filename(app.static_folder, gu)
    plot_url = url_for("static", filename=f"gu_barplots/{fname}") if fname else None

    return render_template("detail.html", gu=gu, plot_url=plot_url)

if __name__ == "__main__":
    app.run(debug=True)
