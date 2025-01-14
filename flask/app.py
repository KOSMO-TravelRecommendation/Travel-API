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
            
            # 주소에서 시도 정보 추출 (NaN 값 안전하게 처리)
            df['SIDO'] = df['LOTNO_ADDR'].fillna('').str.split().str[0]
            
            # 관광지 타입 필터링 (1-8)
            df = df[df['VISIT_AREA_TYPE_CD'].isin(range(1, 9))]
            
            # 중복 제거: 같은 관광지명은 하나만 유지
            df = df.sort_values('VISIT_AREA_TYPE_CD').drop_duplicates(
                subset=['VISIT_AREA_NM'], 
                keep='first'
            )
            
            df['REGION'] = region
            all_data.append(df)
            logger.info(f"Loaded data for region {region}")
            logger.debug(f"Columns in file: {df.columns.tolist()}")
            
        except Exception as e:
            logger.error(f"Error loading data for {region}: {e}")
            raise
            
    combined_data = pd.concat(all_data, ignore_index=True)
    
    # 전체 데이터에서도 한번 더 중복 제거 (다른 region에 같은 이름의 장소가 있을 수 있음)
    combined_data = combined_data.sort_values('VISIT_AREA_TYPE_CD').drop_duplicates(
        subset=['VISIT_AREA_NM'], 
        keep='first'
    )
    
    logger.info(f"Final combined data shape after deduplication: {combined_data.shape}")
    return combined_data

def calculate_weights(survey_data):
    """사용자 선호도에 따른 가중치 계산"""
    try:
        weights = {}
        
        # 자연 관광지 (type 1, 2)
        nature_weight = (float(survey_data.get('nature_rating', 3)) / 5.0) * 1.2
        weights.update({1: nature_weight, 2: nature_weight})
        
        # 문화 관광지 (type 3, 4)
        culture_weight = (float(survey_data.get('culture_rating', 3)) / 5.0) * 1.2
        weights.update({3: culture_weight, 4: culture_weight})
        
        # 체험 관광지 (type 5, 6)
        activity_weight = (float(survey_data.get('activity_rating', 3)) / 5.0) * 1.2
        weights.update({5: activity_weight, 6: activity_weight})
        
        # 동반자 유형에 따른 가중치
        companion_type = survey_data.get('companion_type', '')
        if companion_type == '가족':
            weights[1] *= 1.1  # 가족 동반시 자연 명소 선호
            weights[5] *= 1.1  # 가족 동반시 체험 관광지 선호
        
        # 이동수단에 따른 가중치
        transport = survey_data.get('transport_primary', '')
        if transport == '대중교통':
            for type_id in weights:
                weights[type_id] *= 1.1 if type_id in [3, 4] else 0.9
        
        # 연령대에 따른 가중치
        age_group = survey_data.get('age_group', 0)
        if age_group < 30:
            weights[5] *= 1.1  # 젊은층 체험 선호
        elif age_group > 50:
            weights[3] *= 1.1  # 장년층 문화 선호
                
        return weights
    except Exception as e:
        logger.error(f"Error calculating weights: {e}")
        raise

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
        logger.debug(f"Request data: {request.json}")
        
        if not request.json:
            raise ValueError("No JSON data in request")
            
        if 'survey_data' not in request.json:
            raise ValueError("Missing 'survey_data' in request")
            
        if 'model_type' not in request.json:
            raise ValueError("Missing 'model_type' in request")
        
        survey_data = request.json['survey_data']
        model_type = request.json['model_type']
        
        logger.info(f"Processing prediction for model_type: {model_type}")
        logger.debug(f"Survey data: {survey_data}")
        
        # SIDO 확인
        sido = survey_data.get('SIDO')
        if not sido:
            raise ValueError("Missing or invalid 'SIDO' in survey_data")
        
        # 모델 선택
        model = MODELS.get(model_type)
        if not model:
            raise ValueError(f"Invalid model type: {model_type}")
        
        # 해당 지역의 관광지 필터링 (SIDO 매칭 로직 개선)
        sido_pattern = f"{sido}(?:특별시|광역시|특별자치시|특별자치도|도)?"
        region_items = REGION_DATA[(
            REGION_DATA['SIDO'].str.contains(sido_pattern, na=False, regex=True)) &
            (REGION_DATA['VISIT_AREA_TYPE_CD'].isin(range(1, 9)))
        ]
        
        # 중복 제거: 같은 관광지명은 하나만 유지
        region_items = region_items.sort_values('VISIT_AREA_TYPE_CD').drop_duplicates(
            subset=['VISIT_AREA_NM'], 
            keep='first'
        )
        
        if region_items.empty:
            raise ValueError(f"No items found for region: {sido}")
            
        # 가중치 계산
        weights = calculate_weights(survey_data)
        
        # 예측 수행 (중복 제거된 데이터 사용)
        predictions = []
        seen_places = set()  # 중복 체크를 위한 set
        
        for _, place in region_items.iterrows():
            place_name = place['VISIT_AREA_NM']
            
            # 이미 추천된 장소는 건너뛰기
            if place_name in seen_places:
                continue
                
            try:
                base_score = model.predict('new_user', place_name).est
                weight = weights.get(place['VISIT_AREA_TYPE_CD'], 1.0)
                
                # 추가 가중치: 대중교통 접근성
                if survey_data.get('transport_primary') == '대중교통':
                    location = str(place['LOTNO_ADDR']).lower()
                    if '역' in location or '터미널' in location:
                        weight *= 1.1
                final_score = base_score * weight
                
                predictions.append({
                    'place_name': place_name,
                    'address': place['LOTNO_ADDR'],
                    'type': int(place['VISIT_AREA_TYPE_CD']),
                    'score': float(final_score)
                })
                
                seen_places.add(place_name)  # 추천된 장소 기록
                
            except Exception as e:
                logger.warning(f"Skipping prediction for {place_name}: {e}")
                continue
        
        if not predictions:
            raise ValueError("No valid predictions generated")
        
        # 상위 5개 추천
        top_predictions = sorted(predictions, key=lambda x: x['score'], reverse=True)[:5]
        logger.info(f"Generated {len(top_predictions)} unique recommendations")
        
        return jsonify({
            "status": "success",
            "recommendations": top_predictions
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
