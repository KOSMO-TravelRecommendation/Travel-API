# Capital_model.py
import pandas as pd
import numpy as np
from surprise import SVD, Dataset, Reader
from surprise.model_selection import train_test_split, GridSearchCV, cross_validate
import joblib
import pickle

def train_capital_model():
    # 데이터 로드
    visit_capital = pd.read_csv('../csv/tn_visit_area_info_E.csv')
    
    # 관광지 필터링
    visit_info = visit_capital[(visit_capital['VISIT_AREA_TYPE_CD'].isin(range(1, 9)))]
    visit_info = visit_info.groupby('VISIT_AREA_NM').filter(lambda x: len(x) > 1)
    visit_info = visit_info.reset_index(drop=True)
    
    # 평점 계산
    visit_info['ratings'] = visit_info[['DGSTFN', 'REVISIT_INTENTION', 'RCMDTN_INTENTION']].mean(axis=1)
    visit_info['TRAVELER_ID'] = visit_info['TRAVEL_ID'].str.split('_').str[1]
    visit_info['SIDO'] = visit_info['LOTNO_ADDR'].str.split().str[0]
    
    # 데이터프레임 정리
    df = visit_info.rename(columns={
        'TRAVELER_ID': 'userID',
        'VISIT_AREA_NM': 'itemID',
        'ratings': 'rating'
    })[['userID', 'itemID', 'rating', 'SIDO']]
    
    # Surprise 데이터셋 준비
    reader = Reader(rating_scale=(1, 5))
    data = Dataset.load_from_df(df[['userID', 'itemID', 'rating']], reader)
    
    # 모델 파라미터 최적화
    param_grid = {
        'n_factors': [50, 100, 200],
        'n_epochs': [10, 50],
        'lr_all': [0.01, 0.1],
        'reg_all': [0.01, 0.1],
        'reg_bu': [0.01, 0.1],
        'reg_bi': [0.01, 0.1]
    }
    
    grid = GridSearchCV(SVD, param_grid, measures=['RMSE', 'MAE'], cv=5, n_jobs=-1)
    grid.fit(data)
    
    # 최적 파라미터로 모델 학습
    best_params = grid.best_params['rmse']
    algo = SVD(**best_params)
    trainset, testset = train_test_split(data, test_size=0.2, random_state=42)
    algo.fit(trainset)
    
    # 모델 저장
    with open('../models/Capital_model.joblib', 'wb') as f:
        pickle.dump(algo, f)
    
    return algo, df

# East_model.py
def train_east_model():
    # 데이터 로드
    visit_east = pd.read_csv('../csv/tn_visit_area_info_F.csv')
    # ... [위와 동일한 구조로 East 모델 학습]

# West_model.py
def train_west_model():
    # 데이터 로드
    visit_west = pd.read_csv('../csv/tn_visit_area_info_G.csv')
    # ... [위와 동일한 구조로 West 모델 학습]

# Jeju_model.py
def train_jeju_model():
    # 데이터 로드
    visit_jeju = pd.read_csv('../csv/tn_visit_area_info_H.csv')
    # ... [위와 동일한 구조로 Jeju 모델 학습]

if __name__ == "__main__":
    # 각 모델 학습
    capital_model, capital_df = train_capital_model()
    east_model, east_df = train_east_model()
    west_model, west_df = train_west_model()
    jeju_model, jeju_df = train_jeju_model()