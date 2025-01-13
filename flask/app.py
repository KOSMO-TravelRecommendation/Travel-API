from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import pickle
import os
import logging
from surprise import Dataset, Reader

# 로깅 설정
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'models')
DATA_DIR = os.path.join(BASE_DIR, 'data')

def load_models():
    """권역별 모델 로드"""
    models = {}
    region_mapping = {
        'CAPITAL': 'E',  # 수도권
        'WEST': 'F',    # 서부권
        'EAST': 'G',    # 동부권
        'JEJU': 'H'     # 제주도
    }
    
    for region, code in region_mapping.items():
        model_path = os.path.join(MODEL_DIR, f'enhanced_svd_model_{code}.pkl')
        try:
            models[region] = joblib.load(model_path)
            logger.info(f"Loaded model for {region}")
        except Exception as e:
            logger.error(f"Error loading model for {region}: {e}")
            raise
    return models

def load_region_data():
    """권역별 데이터 로드 및 전처리"""
    region_mapping = {
        'CAPITAL': ['서울특별시', '인천광역시', '경기도'],
        'WEST': ['전라북도', '전라남도', '충청북도', '충청남도', 
                '광주광역시', '대전광역시', '세종특별시'],
        'EAST': ['부산광역시', '대구광역시', '울산광역시', 
                '경상남도', '경상북도', '강원도'],
        'JEJU': ['제주특별자치도']
    }
    
    file_codes = {
        'CAPITAL': 'E',
        'WEST': 'F',
        'EAST': 'G',
        'JEJU': 'H'
    }
    
    all_data = []
    for region, code in file_codes.items():
        try:
            file_path = os.path.join(DATA_DIR, f'tn_visit_area_info_{code}.csv')
            logger.info(f"Loading file: {file_path}")
            
            df = pd.read_csv(file_path, encoding='utf-8')
            df['SIDO'] = df['LOTNO_ADDR'].fillna('').str.split().str[0]
            df = df[df['VISIT_AREA_TYPE_CD'].isin(range(1, 9))]
            df = df.sort_values('VISIT_AREA_TYPE_CD').drop_duplicates(
                subset=['VISIT_AREA_NM'], 
                keep='first'
            )
            
            df['REGION'] = region
            all_data.append(df)
            logger.info(f"Loaded data for region {region}")
            
        except Exception as e:
            logger.error(f"Error loading data for {region}: {e}")
            raise
            
    combined_data = pd.concat(all_data, ignore_index=True)
    combined_data = combined_data.sort_values('VISIT_AREA_TYPE_CD').drop_duplicates(
        subset=['VISIT_AREA_NM'], 
        keep='first'
    )
    
    logger.info(f"Final combined data shape: {combined_data.shape}")
    return combined_data

def calculate_weights(survey_data):
    """개선된 사용자 선호도 가중치 계산"""
    try:
        weights = {}
        
        # 기본 선호도 가중치 강화
        nature_weight = (float(survey_data.get('nature_rating', 3)) / 5.0) * 2.0
        culture_weight = (float(survey_data.get('culture_rating', 3)) / 5.0) * 2.0
        activity_weight = (float(survey_data.get('activity_rating', 3)) / 5.0) * 2.0
        
        weights.update({
            1: nature_weight,   # 자연 관광지
            2: nature_weight,   # 자연 휴양지
            3: culture_weight,  # 문화 유적지
            4: culture_weight,  # 박물관/미술관
            5: activity_weight, # 체험 관광지
            6: activity_weight, # 액티비티
            7: 1.0,            # 쇼핑/맛집
            8: 1.0             # 기타
        })
        
        # 예산에 따른 가중치 강화
        budget = survey_data.get('budget', '')
        if budget:
            if budget == '10만원 미만':
                for type_id in [1, 2, 3]:  # 자연, 문화 관광지 선호
                    weights[type_id] *= 2.0
                for type_id in [5, 6, 7]:  # 체험, 쇼핑 비선호
                    weights[type_id] *= 0.5
            elif budget == '30만원 ~ 50만원':
                for type_id in [5, 6]:     # 체험/액티비티 선호
                    weights[type_id] *= 1.8
            elif budget == '50만원 이상':  
                for type_id in [5, 6, 7]:  # 프리미엄 경험 선호
                    weights[type_id] *= 2.0
        
        # 동반자 유형에 따른 가중치 강화
        companion_type = survey_data.get('companion_type', '').lower()
        if companion_type == '가족':
            weights[1] *= 1.8  # 자연 명소
            weights[5] *= 1.8  # 체험 관광지
        elif companion_type == '연인':
            weights[7] *= 2.0  # 쇼핑/맛집
            weights[1] *= 1.8  # 자연 명소
        elif companion_type == '친구':
            weights[6] *= 2.0  # 액티비티
            weights[7] *= 1.8  # 쇼핑/맛집
        
        # 연령대에 따른 가중치 강화
        age_group = survey_data.get('age_group', 0)
        if age_group < 30:
            weights[5] *= 1.8  # 체험 선호
            weights[6] *= 1.8  # 액티비티 선호
            weights[7] *= 1.8  # 쇼핑 선호
        elif age_group > 50:
            weights[3] *= 1.8  # 문화 유적지 선호
            weights[4] *= 1.8  # 박물관/미술관 선호
            
        return weights
    except Exception as e:
        logger.error(f"Error calculating weights: {e}")
        raise

def diversify_recommendations(predictions, top_k=5):
    """추천 결과의 다양성 보장"""
    type_counts = {}
    diverse_predictions = []
    
    for pred in sorted(predictions, key=lambda x: x['score'], reverse=True):
        place_type = pred['type']
        
        # 각 타입별 최대 개수 제한
        if type_counts.get(place_type, 0) < 2:  # 각 타입당 최대 2개
            diverse_predictions.append(pred)
            type_counts[place_type] = type_counts.get(place_type, 0) + 1
            
        if len(diverse_predictions) >= top_k:
            break
            
    return diverse_predictions

# 전역 변수로 모델과 데이터 로드
try:
    MODELS = load_models()
    REGION_DATA = load_region_data()
    logger.info("Successfully loaded all models and data")
except Exception as e:
    logger.error(f"Failed to initialize models or data: {e}")
    raise

@app.route('/predict', methods=['POST'])
def predict():
    try:
        logger.info("Received prediction request")
        
        if not request.json:
            raise ValueError("No JSON data in request")
            
        if 'survey_data' not in request.json:
            raise ValueError("Missing 'survey_data' in request")
            
        if 'model_type' not in request.json:
            raise ValueError("Missing 'model_type' in request")
        
        survey_data = request.json['survey_data']
        model_type = request.json['model_type']
        
        logger.info(f"Processing prediction for model_type: {model_type}")
        
        # 개선된 사용자 ID 생성
        user_id = f"{survey_data.get('gender')}_{survey_data.get('age_group')}_{survey_data.get('companion_type')}_{model_type}_{survey_data.get('travel_motive_primary')}"
        
        # SIDO 확인
        sido = survey_data.get('SIDO')
        if not sido:
            raise ValueError("Missing or invalid 'SIDO' in survey_data")
        
        # 모델 선택
        model = MODELS.get(model_type)
        if not model:
            raise ValueError(f"Invalid model type: {model_type}")
        
        # 해당 지역의 관광지 필터링
        sido_pattern = f"{sido}(?:특별시|광역시|특별자치시|특별자치도|도)?"
        region_items = REGION_DATA[
            (REGION_DATA['SIDO'].str.contains(sido_pattern, na=False, regex=True)) &
            (REGION_DATA['VISIT_AREA_TYPE_CD'].isin(range(1, 9)))
        ]
        
        if region_items.empty:
            raise ValueError(f"No items found for region: {sido}")
            
        # 가중치 계산
        weights = calculate_weights(survey_data)
        
        # 예측 수행
        predictions = []
        seen_places = set()
        
        for _, place in region_items.iterrows():
            place_name = place['VISIT_AREA_NM']
            
            if place_name in seen_places:
                continue
                
            try:
                # 예측 점수 계산
                base_score = model.predict(user_id, place_name).est
                weight = weights.get(place['VISIT_AREA_TYPE_CD'], 1.0)
                
                # 선호도 가중치 강화
                preference_multiplier = 1.0
                
                # 여행 동기와 장소 타입 매칭 강화
                travel_motive = survey_data.get('travel_motive_primary', '').lower()
                if travel_motive == '자연/풍경 감상' and place['VISIT_AREA_TYPE_CD'] in [1, 2]:
                    preference_multiplier *= 2.0
                elif travel_motive == '문화/역사 체험' and place['VISIT_AREA_TYPE_CD'] in [3, 4]:
                    preference_multiplier *= 2.0
                elif travel_motive == '체험/액티비티' and place['VISIT_AREA_TYPE_CD'] in [5, 6]:
                    preference_multiplier *= 2.0
                elif travel_motive == '쇼핑' and place['VISIT_AREA_TYPE_CD'] == 7:
                    preference_multiplier *= 2.0
                
                # 이동수단 접근성 강화
                if survey_data.get('transport_primary') == '대중교통':
                    location = str(place['LOTNO_ADDR']).lower()
                    if '역' in location or '터미널' in location:
                        preference_multiplier *= 1.8
                
                # 최종 점수 계산
                final_score = base_score * weight * preference_multiplier
                
                predictions.append({
                    'place_name': place_name,
                    'address': place['LOTNO_ADDR'],
                    'type': int(place['VISIT_AREA_TYPE_CD']),
                    'score': float(final_score)
                })
                
                seen_places.add(place_name)
                
            except Exception as e:
                logger.warning(f"Skipping prediction for {place_name}: {e}")
                continue
        
        if not predictions:
            raise ValueError("No valid predictions generated")
        
        # 추천 결과 다양성 보장
        diverse_predictions = diversify_recommendations(predictions)
        
        # 점수 정규화 (0-10 범위로)
        max_score = max(p['score'] for p in diverse_predictions)
        min_score = min(p['score'] for p in diverse_predictions)
        score_range = max_score - min_score
        
        for p in diverse_predictions:
            p['score'] = 5 + (p['score'] - min_score) / score_range * 5 if score_range > 0 else 5
        
        logger.info(f"Generated {len(diverse_predictions)} diverse recommendations")
        
        return jsonify({
            "status": "success",
            "recommendations": diverse_predictions
        })
        
    except Exception as e:
        logger.error(f"Error in prediction: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500

@app.route('/healthcheck', methods=['GET'])
def healthcheck():
    """서버 상태 체크 엔드포인트"""
    try:
        return jsonify({
            "status": "healthy",
            "models": list(MODELS.keys()),
            "data_shape": REGION_DATA.shape
        })
    except Exception as e:
        logger.error(f"Healthcheck failed: {e}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)