import React, { useState, useEffect } from "react";
import axios from "axios";

const SurveyHandler = () => {
  const [surveyData, setSurveyData] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const questions = [
    "여행 지역",
    "성별",
    "연령대",
    "동반자 수",
    "여행 스타일",
    "여행 기간",
    "이동수단",
    "여행 예산",
  ];
  // 설문 응답을 Flask API 형식으로 변환
  const transformSurveyData = (inputs) => {
    const city = inputs[0];
    return {
      inputs: {
        LOTNO_ADDR: [city],
        GENDER: [mapGenderGroup(inputs[1])],
        AGE_GRP: [mapAgeGroup(inputs[2])],
        TRAVEL_COMPANIONS_NUM: [mapCompanionCount(inputs[3])],
        TRAVEL_PURPOSE: [mapTravelPurpose(inputs[4])],
        Date: [mapTravelDuration(inputs[5])],
        MVMN_SE_NM: [mapTransport(inputs[6])],
        PAYMENT_AMT_WON: [mapBudget(inputs[7])],
      },
    };
  };

  // 연령대 변환 함수
  const mapGenderGroup = (gender) => {
    const genderMapping = {
      "남성" : "남" , "여성" :"여"
    };
    return genderMapping[gender] || "남";
  };

  // 연령대 변환 함수
  const mapAgeGroup = (age) => {
    const ageMapping = {
      "10대": 10, "20대": 20, "30대": 30, "40대": 40, "50대": 50, "60대": 60, "70대 이상": 70
    };
    return ageMapping[age] || 10;
  };

  // 동반자 수 변환 함수
  const mapCompanionCount = (companions) => {
    const companionMapping = {
      "혼자": 0, "1명": 1, "2명": 2, "3명": 3, "4명": 4, "5명": 5,
      "6명": 6, "7명": 7, "8명": 8, "9명": 9, "10명": 10, "11명 이상": 11,
    };
    return companionMapping[companions] || 0; 
  };

// 여행 스타일 변환 함수
const mapTravelPurpose = (style) => {
  const styles = {
    "쇼핑": 1,"테마파크": 2,"놀이시설": 3,"동/식물원 방문": 4,"역사 유적지 방문": 5,
    "시티투어": 6,"야외 스포츠": 7,"레포츠 활동": 8,"지역 문화예술/공연/전시시설 관람": 9,
    "유흥/오락(나이트라이프)": 10,"캠핑": 11,"지역 축제/이벤트 참가": 12,"온천/스파": 13,
    "교육/체험 프로그램 참가": 14,"드라마 촬영지 방문": 15,"종교/성지 순례": 16,"Well-ness 여행": 17,
    "SNS 인생샷 여행": 18,"호캉스 여행": 19,"신규 여행지 발굴": 20,"반려동물 동반 여행": 21,
    "인플루언서 따라하기 여행": 22, "친환경 여행(플로깅 여행)": 23,"등반 여행": 24,
  };

  // 스타일이 문자열이면 세미콜론으로 구분하여 처리
  if (typeof style === 'string') {
    return style.split(";").map((item) => styles[item.trim()] || 1).join(";");
  }

  // 스타일이 배열이면, 배열의 각 항목을 처리 후 세미콜론으로 구분
  if (Array.isArray(style)) {
    return style.map((item) => styles[item] || 1).join(";");
  }

  // 문자열도 배열도 아닌 경우 기본값 반환
  return "1"; // 기본적으로 1
};



  // 여행 기간 변환 함수
  const mapTravelDuration = (duration) => {
    const durationMapping = {
      "당일치기": 1, "1박2일": 2, "2박3일": 3, "3박4일": 4, "그 이상": 5
    };
    return durationMapping[duration] || 1; // 매핑되지 않은 경우 0을 반환
  };

  // 이동수단 변환 함수
  const mapTransport = (transport) => {
    const transportMapping = {
      "자가용": 0, "버스": 1, "기차": 2, "택시": 3, "기타": 4, "버스+지하철": 50
    };
    return transportMapping[transport] || 0;
  };

  // 여행 예산 변환 함수
  const mapBudget = (budget) => {
    const budgetMapping = {
      "10만원 이하": 1, "10만원 ~ 20만원": 2, "20만원 ~ 50만원": 3, "50만원 ~ 100만원": 4, "100만원 이상": 5
    };
    return budgetMapping[budget] || 1; // 매핑되지 않은 경우 0을 반환
  };


  // Spring에서 최신 설문 데이터 가져오기
  const fetchSurveyData = async () => {
    try {
      const response = await axios.get(
        "http://localhost:8080/api/survey/latest"
      );
      setSurveyData(response.data);
      return response.data;
    } catch (err) {
      setError("설문 데이터를 가져오는데 실패했습니다");
      throw err;
    }
  };

  // Flask API로 예측 요청
  const requestPrediction = async (transformedData) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/predict",
        transformedData
      );
      return response.data.top_predictions; // 여러 개의 예측을 배열로 반환
    } catch (err) {
      setError("AI 예측에 실패했습니다");
      throw err;
    }
  };

  // Spring으로 예측 결과 전송
  const sendPredictionToSpring = async (predictions) => {
    try {
      await axios.post("http://localhost:8080/api/survey/predictions", {
        predictions: predictions,
      });
    } catch (err) {
      setError("예측 결과 저장에 실패했습니다");
      throw err;
    }
  };

  // 전체 프로세스 실행
  const processSurveyData = async () => {
    setLoading(true);
    try {
      const surveyData = await fetchSurveyData();
      const transformedData = transformSurveyData(surveyData.inputs);
      const predictionResults = await requestPrediction(transformedData);
      await sendPredictionToSpring(predictionResults);
      setPredictions(predictionResults); // 여러 예측 결과를 배열로 처리
    } catch (err) {
      console.error("Error in processing survey:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    processSurveyData();
  }, []);

  // Styles
  const containerStyle = {
    maxWidth: "800px",
    margin: "2rem auto",
    padding: "2rem",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    borderRadius: "8px",
    backgroundColor: "white",
  };

  const sectionStyle = {
    marginBottom: "2rem",
    padding: "1rem",
    borderBottom: "1px solid #eee",
  };

  const predictionItemStyle = {
    padding: "0.5rem",
    marginBottom: "0.5rem",
    backgroundColor: "#f3f4f6",
    borderRadius: "4px",
  };

  return (
    <div style={containerStyle}>
      <h2 className="text-2xl font-bold mb-6 text-center">여행지 추천 결과</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <p>AI가 최적의 여행지를 분석중입니다...</p>
        </div>
      ) : (
        <>
          {surveyData && (
            <div style={sectionStyle}>
              <h3 className="text-xl font-semibold mb-4">설문 응답 내용</h3>
              {surveyData.inputs.map((answer, index) => (
                <div key={index} className="mb-2">
                  <span className="font-medium">{questions[index]}: </span>
                  <span>
                    {index === 4 && Array.isArray(answer)  // 여행 스타일(checkbox)은 배열로 온다고 가정
                      ? answer.join(", ")   // 배열 값들을 쉼표로 구분하여 출력
                      : answer}  {/* 그 외 값은 그대로 출력 */}
                  </span>
                </div>
              ))}
            </div>
          )}


          {predictions && (
            <div style={sectionStyle}>
              <h3 className="text-xl font-semibold mb-4">추천 여행지</h3>
              {/* 여행 스타일을 쉼표로 구분하여 출력 */}
              <div>
                <span>
                  {predictions
                    .map((prediction, index) => prediction.label)
                    .join(", ")}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SurveyHandler;
