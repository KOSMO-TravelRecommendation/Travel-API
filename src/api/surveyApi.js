import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SurveyHandler = () => {
  const [surveyData, setSurveyData] = useState(null);
  const [error, setError] = useState(null);

  // HTML 파일의 surveyQuestions 순서와 동일하게 맞춤
  const questions = [
    "여행 지역",
    "성별",
    "연령대",
    "동반자 수",
    "여행 스타일",
    "여행 기간",
    "이동수단",
    "여행 예산"
  ];

  const fetchSurveyData = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/survey/latest');
      setSurveyData(response.data);
      setError(null);
    } catch (err) {
      setError('설문 데이터를 가져오는데 실패했습니다');
      console.error('Error fetching survey data:', err);
    }
  };

  useEffect(() => {
    fetchSurveyData();
  }, []);

  const containerStyle = {
    maxWidth: '600px',
    margin: '1rem auto',
    padding: '1rem',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    backgroundColor: 'white'
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: '1.5rem',
    padding: '1rem',
    borderBottom: '1px solid #eee'
  };

  const errorStyle = {
    backgroundColor: '#fee2e2',
    border: '1px solid #ef4444',
    color: '#dc2626',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '1rem'
  };

  const questionContainerStyle = {
    marginBottom: '1rem',
    paddingBottom: '0.5rem',
    borderBottom: '1px solid #eee'
  };

  const questionLabelStyle = {
    fontWeight: '600',
    color: '#374151',
    marginBottom: '0.25rem'
  };

  const answerStyle = {
    color: '#6b7280'
  };

  const loadingStyle = {
    textAlign: 'center',
    padding: '2rem',
    color: '#6b7280'
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>설문 결과</h2>
      </div>
      
      {error && (
        <div style={errorStyle}>
          {error}
        </div>
      )}

      {surveyData && surveyData.inputs && (
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            최신 설문 응답
          </h3>
          {surveyData.inputs.map((answer, index) => (
            <div key={index} style={questionContainerStyle}>
              <p style={questionLabelStyle}>{questions[index]}</p>
              <p style={answerStyle}>
                {answer}
              </p>
            </div>
          ))}
        </div>
      )}

      {!surveyData && !error && (
        <div style={loadingStyle}>
          AI 분석중...
        </div>
      )}
    </div>
  );
};

export default SurveyHandler;