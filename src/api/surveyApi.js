import React, { useState } from 'react';
import axios from 'axios';

const SurveyHandler = () => {
  const [surveyData, setSurveyData] = useState(null);
  const [error, setError] = useState(null);

  // Survey 데이터를 받는 API 엔드포인트
  const fetchSurveyData = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/survey/latest');
      setSurveyData(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch survey data');
      console.error('Error fetching survey data:', err);
    }
  };

  // 컴포넌트가 마운트될 때 데이터 가져오기
  React.useEffect(() => {
    fetchSurveyData();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">설문 결과</h2>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
      )}
      
      {surveyData && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">최신 설문 응답</h3>
          <div className="space-y-4">
            {surveyData.inputs?.map((answer, index) => (
              <div key={index} className="border-b pb-2">
                <p className="font-medium">질문 {index + 1}</p>
                <p className="text-gray-600">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {!surveyData && !error && (
        <div className="text-gray-500">
          AI 분석중...
        </div>
      )}
    </div>
  );
};

export default SurveyHandler;