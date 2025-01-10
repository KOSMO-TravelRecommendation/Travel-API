import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

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
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-4">AI가 최적의 여행지를 분석중입니다...</h2>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                    <strong className="font-bold">오류 발생!</strong>
                    <p className="block sm:inline"> {error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-8 text-center">맞춤 여행지 추천 결과</h1>
            
            {recommendations && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {recommendations.map((place, index) => (
                        <div key={index} className="p-4 border rounded-lg shadow-md hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xl font-semibold">{place.place_name}</h3>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                                    {place.score.toFixed(1)}점
                                </span>
                            </div>
                            <p className="text-gray-600 text-sm mb-2">{place.address}</p>
                            <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                {getPlaceTypeName(place.type)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SurveyResults;