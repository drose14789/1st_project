from flask import Flask, render_template, request, jsonify
import os, json
import pandas as pd
import joblib
import numpy as np

BASE_DIR = os.path.dirname(__file__)

app = Flask(__name__, static_folder="static", template_folder="templates")

MODEL_PATH = os.path.join(BASE_DIR, "models", "final_xgb_closure_model.pkl")
GEOJSON_PATH = os.path.join(BASE_DIR, "data", "seoul-gu.geojson")

# ===== 모델 로드 =====
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"모델 파일이 없습니다: {MODEL_PATH}")

obj = joblib.load(MODEL_PATH)

if isinstance(obj, dict):
    model = obj.get("model", None)
    threshold = float(obj.get("threshold", 0.5))  # 참고용 (등급 산정에는 직접 안 씀)
    defaults_latest = obj.get("defaults_latest", {})
    pop_by_gu = obj.get("pop_by_gu", {})
    pop_global_latest = obj.get("pop_global_latest", None)
    pyeong_to_size = obj.get("pyeong_to_size", {})
else:
    model = obj
    threshold = 0.5
    defaults_latest = {}
    pop_by_gu = {}
    pop_global_latest = None
    pyeong_to_size = {}

if model is None or not hasattr(model, "predict"):
    raise TypeError("pkl에서 predict 가능한 모델을 찾지 못했습니다. dict['model'] 확인 필요")

# ===== 모델 입력 컬럼(학습과 동일해야 함) =====
REQ_COLS = [
    "base_rate",
    "시설총규모",
    "인허가일자_경제활동참가율",
    "인허가일자_실업률",
    "인허가일자_고용률",
    "구별인구",
    "창업월",
    "업태_그룹",
    "구",
]

NUM_COLS = [
    "base_rate",
    "시설총규모",
    "인허가일자_경제활동참가율",
    "인허가일자_실업률",
    "인허가일자_고용률",
    "구별인구",
    "창업월",
]

BIZ_OPTIONS = ["한식", "중식", "일식", "양식", "카페", "분식", "치킨", "주점", "기타"]


# ---------- 헬퍼 ----------
def safe_float(x, fallback):
    try:
        v = float(x)
        if np.isnan(v) or np.isinf(v):
            return float(fallback)
        return v
    except Exception:
        return float(fallback)


def get_default(name: str, fallback: float) -> float:
    if isinstance(defaults_latest, dict):
        return safe_float(defaults_latest.get(name, fallback), fallback)
    return float(fallback)


def pyeong_to_facility_size(pyeong: int) -> float:
    try:
        p = int(pyeong)
    except Exception:
        return safe_float(pyeong, 10.0)

    if isinstance(pyeong_to_size, dict) and p in pyeong_to_size:
        return safe_float(pyeong_to_size[p], float(p))
    return float(p)


def gu_population(gu: str) -> float:
    # 0 방지 (전처리에서 log(0) 같은 문제 예방)
    if isinstance(pop_by_gu, dict) and gu in pop_by_gu:
        return safe_float(pop_by_gu[gu], pop_global_latest or 100000.0)
    if pop_global_latest is not None:
        return safe_float(pop_global_latest, 100000.0)
    return 100000.0


def validate_X(row: dict):
    X = pd.DataFrame([row], columns=REQ_COLS)
    X[NUM_COLS] = X[NUM_COLS].apply(pd.to_numeric, errors="coerce")

    nan_map = X.isna().sum().to_dict()
    if any(v > 0 for v in nan_map.values()):
        return None, {"error": "입력값에 NaN이 있어 예측 불가", "nan_by_col": nan_map, "row": row}

    # inf 검사
    inf_cols = []
    for c in NUM_COLS:
        vals = X[c].values.astype(float)
        if np.isinf(vals).any():
            inf_cols.append(c)
    if inf_cols:
        return None, {"error": "입력값에 Inf가 있어 예측 불가", "inf_cols": inf_cols, "row": row}

    return X, None


def risk_grade(risk_pct: float) -> str:
    # ✅ 등급 기준(원하는대로 조절)
    if risk_pct < 20:
        return "매우 낮음"
    if risk_pct < 40:
        return "낮음"
    if risk_pct < 60:
        return "보통"
    if risk_pct < 80:
        return "높음"
    return "매우 높음"


# ---------- 라우트 ----------
@app.route("/", methods=["GET"])
def main():
    return render_template("main.html", biz_options=BIZ_OPTIONS)


@app.route("/api/seoul-geojson", methods=["GET"])
def api_geojson():
    if not os.path.exists(GEOJSON_PATH):
        return jsonify({"ok": False, "error": f"GeoJSON 파일이 없습니다: {GEOJSON_PATH}"}), 500
    try:
        with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
            geo = json.load(f)
        return jsonify({"ok": True, "geo": geo})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(force=True) or {}

        gu = str(data.get("gu", "")).strip()
        biz = str(data.get("biz", "")).strip()
        month = int(data.get("month", 1))
        pyeong = int(data.get("pyeong", 10))

        if not gu:
            return jsonify({"ok": False, "error": "구를 선택하세요."}), 400
        if not biz:
            return jsonify({"ok": False, "error": "업태를 선택하세요."}), 400
        if not (1 <= month <= 12):
            return jsonify({"ok": False, "error": "창업월은 1~12만 가능합니다."}), 400
        if pyeong <= 0:
            return jsonify({"ok": False, "error": "평수는 1 이상이어야 합니다."}), 400

        row = {
            "base_rate": get_default("base_rate", 1.25),
            "시설총규모": pyeong_to_facility_size(pyeong),
            "인허가일자_경제활동참가율": get_default("인허가일자_경제활동참가율", 62.7),
            "인허가일자_실업률": get_default("인허가일자_실업률", 3.4),
            "인허가일자_고용률": get_default("인허가일자_고용률", 60.5),
            "구별인구": gu_population(gu),
            "창업월": float(month),
            "업태_그룹": biz,
            "구": gu,
        }

        X, err = validate_X(row)
        if err:
            return jsonify({"ok": False, **err}), 400

        # ✅ 확률 예측 (0~1)
        if not hasattr(model, "predict_proba"):
            return jsonify({"ok": False, "error": "모델이 predict_proba를 지원하지 않습니다."}), 500

        proba = float(model.predict_proba(X)[0, 1])
        if np.isnan(proba) or np.isinf(proba):
            return jsonify({"ok": False, "error": "predict_proba가 NaN/Inf 반환", "row": row}), 500

        # ✅ 상세 값(%) + 등급
        risk_pct = round(proba * 100, 1)
        grade = risk_grade(risk_pct)

        # (참고용) threshold를 기준으로 위험/비위험 라벨도 같이 줄 수 있음
        binary_label = "위험" if proba >= threshold else "비교적 안전"

        return jsonify({
            "ok": True,
            "risk_pct": risk_pct,           # ✅ 상세 점수(0~100)
            "grade": grade,                 # ✅ 등급
            "label": binary_label,          # (선택) threshold 기준 라벨
            "result": f"폐업 위험도 {risk_pct}% ({grade})",
            "inputs": {"gu": gu, "biz": biz, "month": month, "pyeong": pyeong},
            "features_used": row
        })

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    print("✅ MODEL:", MODEL_PATH)
    print("✅ GEOJSON:", GEOJSON_PATH)
    app.run(debug=True, port=5000)
