import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

const SurveyResults = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [recommendations, setRecommendations] = useState(null);
    const location = useLocation();

    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                setLoading(true);
                
                // 1. Spring 서버에서 최신 설문 데이터 가져오기
                const surveyResponse = await axios.get('/api/survey/latest');
                const surveyData = surveyResponse.data;

                if (!surveyData || !surveyData.inputs) {
                    throw new Error('설문 데이터를 찾을 수 없습니다.');
                }

                // 2. 설문 데이터 가공
                const formattedData = formatSurveyData(surveyData.inputs);
                
                // 3. Flask 서버로 예측 요청
                const searchParams = new URLSearchParams(location.search);
                const modelType = searchParams.get('model');
                
                const predictionResponse = await axios.post('http://localhost:5000/predict', {
                    survey_data: formattedData,
                    model_type: modelType
                });

                if (!predictionResponse.data.recommendations) {
                    throw new Error('추천 결과를 받아오지 못했습니다.');
                }

                // 4. 추천 결과를 Spring 서버에 저장
                await axios.post('/api/survey/predictions', {
                    predictions: predictionResponse.data.recommendations
                });

                setRecommendations(predictionResponse.data.recommendations);
                
            } catch (err) {
                console.error('Error:', err);
                setError(err.message || '추천을 처리하는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [location]);

    const formatSurveyData = (inputs) => {
        // inputs[0]가 객체인지 확인하고 적절히 처리
        const cityData = typeof inputs[0] === 'object' ? inputs[0] : { city: inputs[0] };
        
        return {
            SIDO: cityData.city,
            gender: inputs[1] === '남성' ? 'M' : 'F',
            age_group: parseInt(inputs[2].replace('대', '')),
            companion_count: inputs[3] === '혼자' ? 0 : parseInt(inputs[3].replace('명', '')),
            companion_type: inputs[4].toLowerCase(),
            travel_motive_primary: inputs[5].toLowerCase().replace('/', '_'),
            travel_motive_secondary: inputs[6].toLowerCase().replace('/', '_'),
            transport_primary: inputs[8].toLowerCase(),
            transport_secondary: inputs[9].toLowerCase(),
            nature_rating: convertRatingToNumber(inputs[10]),
            culture_rating: convertRatingToNumber(inputs[11]),
            activity_rating: convertRatingToNumber(inputs[12])
        };
    };

    const convertRatingToNumber = (rating) => {
        const ratings = {
            '매우 선호': 5,
            '선호': 4,
            '보통': 3,
            '비선호': 2,
            '매우 비선호': 1
        };
        return ratings[rating] || 3;
    };

    const getPlaceTypeName = (typeCode) => {
        const types = {
            1: '자연 관광지',
            2: '자연 휴양지',
            3: '문화 유적지',
            4: '박물관/미술관',
            5: '체험 관광지',
            6: '액티비티',
            7: '쇼핑/맛집',
            8: '기타'
        };
        return types[typeCode] || '기타';
    };

    if (loading) {
        return (
            <div className="container min-vh-100 d-flex align-items-center justify-content-center">
                <div className="text-center">
                    <h2 className="h4 mb-4">AI가 최적의 여행지를 분석중입니다...</h2>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container py-5">
                <div className="alert alert-danger" role="alert">
                    <h4 className="alert-heading">오류 발생!</h4>
                    <p className="mb-0">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container py-5">
            <div className="row">
                <div className="col-12">
                    <h1 className="text-center mb-5 display-4">맞춤 여행지 추천 결과</h1>
                </div>
            </div>
            
            {recommendations && (
                <div className="row g-4">
                    {recommendations.map((place, index) => (
                        <div key={index} className="col-md-6 col-lg-4">
                            <div className="card h-100 shadow-sm hover-shadow">
                                <div className="card-body">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h3 className="card-title h5 mb-0">{place.place_name}</h3>
                                        <span className="badge bg-primary rounded-pill">
                                            {place.score.toFixed(1)}점
                                        </span>
                                    </div>
                                    <p className="card-text text-muted small mb-3">
                                        {place.address}
                                    </p>
                                    <span className="badge bg-light text-dark">
                                        {getPlaceTypeName(place.type)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// CSS를 추가하여 호버 효과 개선
const styles = `
    .hover-shadow {
        transition: all 0.3s ease-in-out;
    }
    
    .hover-shadow:hover {
        transform: translateY(-5px);
        box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
    }

    .card {
        border: none;
        border-radius: 10px;
        background: #fff;
    }

    .badge {
        font-weight: 500;
        padding: 0.5em 1em;
    }

    .display-4 {
        font-weight: 600;
        color: #2c3e50;
    }

    .text-muted {
        color: #6c757d !important;
    }

    .spinner-border {
        width: 3rem;
        height: 3rem;
    }
`;

// Style 태그를 문서에 추가
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default SurveyResults;