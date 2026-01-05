# Flask에서 필요한 핵심 기능들을 import
# - Flask: 웹 애플리케이션 객체
# - render_template: HTML 템플릿 렌더링
# - request: URL 파라미터(?gu=강남구) 접근
# - url_for: static 파일의 안전한 URL 생성
from flask import Flask, render_template, request, url_for

# 파일/디렉터리 탐색을 위한 표준 라이브러리
import os


# ============================
# Flask 애플리케이션 생성
# ============================
# __name__을 넘기면
# - templates/
# - static/
# 폴더를 자동으로 인식한다
app = Flask(__name__)


# ============================
# 문자열 정규화 유틸 함수
# ============================
def _norm(s: str) -> str:
    """
    문자열 비교 시 발생할 수 있는 문제를 방지하기 위한 정규화 함수

    - None → ""
    - 앞뒤 공백 제거
    - 문자열 중간의 공백 제거

    예:
        " 강남 구 " → "강남구"
    """
    return (s or "").strip().replace(" ", "")


# ============================
# 구(gu)에 맞는 이미지 파일명 찾기
# ============================
def find_gu_plot_filename(static_folder: str, gu: str):
    """
    static/gu_barplots 폴더 안에서
    전달받은 구(gu)에 가장 잘 맞는 이미지 파일 하나를 찾아 반환한다.

    우선순위 기준:
    1️⃣ 파일명이 gu로 시작하는지
    2️⃣ 파일명에 gu가 포함되는지
    3️⃣ 확장자 우선순위 (png > jpg/jpeg > webp)
    4️⃣ 파일명이 짧을수록 우선
    """

    # Flask가 알고 있는 static 폴더 경로 + gu_barplots
    plot_dir = os.path.join(static_folder, "gu_barplots")

    # 이미지 폴더가 없으면 None 반환 (에러 발생 방지)
    if not os.path.isdir(plot_dir):
        return None

    # 비교용 gu 문자열 정규화
    gu_n = _norm(gu)

    # 허용할 이미지 확장자 목록
    exts = [".png", ".jpg", ".jpeg", ".webp"]

    # gu_barplots 폴더 안의 이미지 파일만 필터링
    files = [
        f for f in os.listdir(plot_dir)
        if os.path.isfile(os.path.join(plot_dir, f))
        and os.path.splitext(f)[1].lower() in exts
    ]

    # 이미지가 하나도 없으면 None 반환
    if not files:
        return None

    # ============================
    # 이미지 우선순위 점수 계산 함수
    # ============================
    def score(fname: str):
        # 파일명에서 확장자 제거
        base = os.path.splitext(fname)[0]

        # 파일명도 정규화해서 비교
        base_n = _norm(base)

        # 확장자 추출
        ext = os.path.splitext(fname)[1].lower()

        # 확장자 우선순위 (숫자가 작을수록 우선)
        ext_rank = {
            ".png": 0,
            ".jpg": 1,
            ".jpeg": 1,
            ".webp": 2
        }.get(ext, 9)

        # 파일명이 gu로 시작하면 우선
        starts = 0 if base_n.startswith(gu_n) else 1

        # 파일명에 gu가 포함되면 우선
        contains = 0 if gu_n in base_n else 1

        # 정렬 기준 튜플
        return (
            contains,      # gu 포함 여부
            starts,        # gu 시작 여부
            ext_rank,      # 확장자 우선순위
            len(base_n)    # 파일명 길이
        )

    # 파일명에 gu가 포함된 이미지들만 후보로 선택
    candidates = [
        f for f in files
        if gu_n in _norm(os.path.splitext(f)[0])
    ]

    # 후보가 없으면 None
    if not candidates:
        return None

    # 점수 기준으로 정렬 후 가장 우선순위 높은 파일 반환
    candidates.sort(key=score)
    return candidates[0]


# ============================
# 메인 페이지 라우트
# ============================
@app.route("/")
def index():
    """
    메인 페이지
    - 지도 UI
    - JS, CSS 로딩
    """
    return render_template("mainpage.html")


# ============================
# 상세 페이지 라우트
# ============================
@app.route("/detail")
def detail():
    """
    구 상세 페이지

    URL 예:
        /detail?gu=강남구
    """

    # URL 파라미터에서 gu 값 가져오기
    # 값이 없으면 기본값 '미지정'
    gu = request.args.get("gu", "미지정")

    # gu에 해당하는 이미지 파일명 찾기
    fname = find_gu_plot_filename(app.static_folder, gu)

    # 이미지 파일이 있으면 static URL 생성
    # 없으면 None
    plot_url = (
        url_for("static", filename=f"gu_barplots/{fname}")
        if fname else None
    )

    # detail.html에 gu와 이미지 URL 전달
    return render_template(
        "detail.html",
        gu=gu,
        plot_url=plot_url
    )


# ============================
# Flask 서버 실행부
# ============================
if __name__ == "__main__":
    # debug=True:
    # - 코드 변경 시 자동 재시작
    # - 에러 발생 시 디버그 화면 제공
    app.run(debug=True)
