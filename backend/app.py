from flask import Flask, request, jsonify
import joblib
import numpy as np

app = Flask(__name__)

# 모델 로드
models = {
    "capital": joblib.load('./models/latent_model_capital.pkl'),
    "east": joblib.load('./models/latent_model_east.pkl'),
    "jeju": joblib.load('./models/latent_model_jeju.pkl'),
    "west": joblib.load('./models/latent_model_west.pkl'),
    "svd_E": joblib.load('./models/svd_model_E.pkl'),
    "svd_F": joblib.load('./models/svd_model_F.pkl'),
    "svd_G": joblib.load('./models/svd_model_G.pkl'),
    "svd_H": joblib.load('./models/svd_model_H.pkl'),
}

@app.route('/predict/<model_name>', methods=['POST'])
def predict(model_name):
    # 모델 선택
    model = models.get(model_name)
    if not model:
        return jsonify({"error": "Model not found"}), 404

    # 데이터 수신
    data = request.json
    features = np.array(data['features']).reshape(1, -1)

    # 예측 수행
    try:
        prediction = model.predict(features)
        return jsonify({"model": model_name, "prediction": int(prediction[0])})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
