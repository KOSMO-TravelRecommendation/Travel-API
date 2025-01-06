from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import logging

app = Flask(__name__)

# CORS 설정
CORS(app, resources={
    r"/predict": {  # /predict 엔드포인트에 대해
        "origins": ["http://localhost:3000"],  # React 서버 주소
        "methods": ["POST", "OPTIONS"],  # 허용할 HTTP 메서드
        "allow_headers": ["Content-Type"]  # 허용할 헤더
    }
})

# 로깅 설정
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("flask.app")

# 모델 경로 설정
MODEL_PATHS = {
    "Capital_model": "models/Capital_model.joblib",
    "East_model": "models/East_model.joblib",
    "Jeju_model": "models/Jeju_model.joblib",
    "West_model": "models/West_model.joblib",
}

# 지역별 모델 매핑
REGION_MODEL_MAPPING = {
    "서울": "Capital_model",
    "경기": "Capital_model",
    "인천": "Capital_model",
    "전북": "West_model",
    "전남": "West_model",
    "충북": "West_model",
    "충남": "West_model",
    "광주": "West_model",
    "대전": "West_model",
    "세종": "West_model",
    "부산": "East_model",
    "대구": "East_model",
    "울산": "East_model",
    "경남": "East_model",
    "경북": "East_model",
    "강원": "East_model",
    "제주도": "Jeju_model",
}

# 모델 로드 및 특성 이름 확인
models = {}
model_features = {}

for model_name, path in MODEL_PATHS.items():
    try:
        models[model_name] = joblib.load(path)
        logger.info(f"{model_name} 로드 성공.")
        if hasattr(models[model_name], "feature_names_in_"):
            model_features[model_name] = models[model_name].feature_names_in_
        else:
            logger.warning(f"{model_name}에 특성 이름 정보가 없습니다.")
            model_features[model_name] = []
    except Exception as e:
        logger.error(f"{model_name} 로드 실패: {str(e)}")
        models[model_name] = None

# 입력 데이터 확장 함수
def expand_features_to_match_model(input_data, feature_names):
    expanded_data = {feature: 0 for feature in feature_names}
    for key, value in input_data.items():
        if key in expanded_data:
            expanded_data[key] = value[0] if isinstance(value, list) else value
    return [expanded_data[feature] for feature in feature_names]

# 입력 데이터 변환 함수
def transform_input(input_data):
    transformed_data = {
        f"LOTNO_ADDR_{input_data['LOTNO_ADDR'][0]}": 1,
        f"GENDER_{input_data['GENDER'][0]}": 1,
        "AGE_GRP": input_data["AGE_GRP"][0],
        "TRAVEL_COMPANIONS_NUM": input_data["TRAVEL_COMPANIONS_NUM"][0],
        f"TRAVEL_PURPOSE_{input_data['TRAVEL_PURPOSE'][0]}": 1,
        "Date": input_data["Date"][0],
        "MVMN_SE_NM": input_data["MVMN_SE_NM"][0],
        "PAYMENT_AMT_WON": input_data["PAYMENT_AMT_WON"][0],
    }
    logger.debug(f"변환된 데이터: {transformed_data}")
    return transformed_data

@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()
        logger.debug(f"받은 데이터: {data}")

        if not data:
            return jsonify({"error": "요청 데이터가 없습니다."}), 400

        inputs = data.get("inputs")

        if not inputs:
            return jsonify({"error": "입력 데이터가 없습니다."}), 400

        # 지역에 따른 모델 선택
        lotno_addr = inputs["LOTNO_ADDR"][0]
        model_name = REGION_MODEL_MAPPING.get(lotno_addr)
        if not model_name or model_name not in models:
            return jsonify({"error": f"지역 '{lotno_addr}'에 대한 모델이 없습니다."}), 400

        model = models[model_name]
        feature_names = model_features.get(model_name, [])
        if len(feature_names) == 0:
            return jsonify({"error": f"모델 '{model_name}'의 특성 이름 정보를 로드할 수 없습니다."}), 500

        # 입력 데이터 처리
        transformed_inputs = transform_input(inputs)
        expanded_inputs = expand_features_to_match_model(transformed_inputs, feature_names)
        model_input = np.array([expanded_inputs], dtype=float)

        # 예측 수행
        probabilities = model.predict_proba(model_input)[0]
        top_indices = np.argsort(probabilities)[-3:][::-1]
        top_predictions = [
            {"label": model.classes_[i], "probability": probabilities[i]} for i in top_indices
        ]

        logger.debug(f"예측 결과: {top_predictions}")
        return jsonify({"top_predictions": top_predictions})
    except Exception as e:
        logger.exception(f"예측 중 오류 발생: {str(e)}")
        return jsonify({"error": f"예측 중 오류 발생: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
