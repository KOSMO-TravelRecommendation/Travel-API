import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8080/api";


// 설문 결과 제출
export const submitSurvey = async (inputs) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/survey-submit`, {
            inputs, // 입력 데이터 전송
        });
        return response.data; // 결과 반환
    } catch (error) {
        throw error.response ? error.response.data : new Error("네트워크 오류");
    }
};

// 설문 결과 가져오기
export const fetchSurveyResults = async () => {
    try {
        const response = await axios.get(`${API_BASE_URL}/survey-results`);
        return response.data; // 결과 반환
    } catch (error) {
        throw error.response ? error.response.data : new Error("네트워크 오류");
    }
};
