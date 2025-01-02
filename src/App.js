// import React, { useState } from "react";
// import "./App.css";
// import Header from "./components/Header";
// import InputContainer from "./components/InputContainer";
// import OutputContainer from "./components/OutputContainer";

// function App() {
//     const [inputResults, setInputResults] = useState(Array(7).fill("")); // 7개의 입력값
//     const [output, setOutput] = useState(""); // 단일 출력값
//     const [status, setStatus] = useState(""); // 상태 메시지

//     const handleSubmit = async (inputs) => {
//         try {
//             const response = await fetch("http://localhost:8080/api/survey-submit", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({ inputs }),
//             });

//             if (response.ok) {
//                 const data = await response.json();
//                 setOutput(data.result || "결과 없음");
//                 setStatus("결과를 성공적으로 받았습니다!");
//             } else {
//                 throw new Error("서버 응답 오류");
//             }
//         } catch (error) {
//             setOutput("");
//             setStatus(`오류 발생: ${error.message}`);
//         }
//     };

//     return (
//         <div>
//             <Header />
//             <div className="main-wrapper">
//                 <InputContainer
//                     inputResults={inputResults}
//                     setInputResults={setInputResults}
//                     onSubmit={handleSubmit}
//                     setStatus={setStatus}
//                 />
//                 <div className="arrow">→</div>
//                 <OutputContainer output={output} />
//             </div>
//             {status && <div className={`status-message ${status.includes("오류") ? "error" : "success"}`}>{status}</div>}
//         </div>
//     );
// }

// export default App;

import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [surveyAnswers, setSurveyAnswers] = useState([]);  // 설문 답변 배열
  const [message, setMessage] = useState('');  // 서버 응답 메시지

  // 설문 답변을 업데이트하는 함수 (예: 체크박스나 라디오버튼의 선택에 따라)
  const handleAnswerChange = (e) => {
    setSurveyAnswers([...surveyAnswers, e.target.value]);
  };

  // 설문 제출 함수
  const submitSurvey = () => {
    // Axios를 사용하여 JSON 형식으로 데이터를 전송
    axios.post('http://localhost:8090/submitSurvey', {
      inputs: surveyAnswers  // surveyAnswers 배열을 서버로 전송
    })
    .then(response => {
      // 서버로부터 받은 응답을 화면에 표시
      setMessage(response.data);
      alert('설문이 성공적으로 제출되었습니다!');
    })
    .catch(error => {
      // 오류 발생 시 메시지 출력
      console.error('설문 제출 중 오류 발생:', error);
      setMessage('설문 제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    });
  };

  return (
    <div>
      {/* 설문 UI 예시 */}
      <h1>설문에 답해주세요</h1>
      <div>
        <label>
          <input 
            type="checkbox" 
            value="답변 1" 
            onChange={handleAnswerChange}
          />
          답변 1
        </label>
        <label>
          <input 
            type="checkbox" 
            value="답변 2" 
            onChange={handleAnswerChange}
          />
          답변 2
        </label>
        <label>
          <input 
            type="checkbox" 
            value="답변 3" 
            onChange={handleAnswerChange}
          />
          답변 3
        </label>
      </div>

      {/* 제출 버튼 */}
      <button onClick={submitSurvey}>설문 제출</button>

      {/* 서버 응답 메시지 */}
      {message && <div id="survey-result">{message}</div>}
    </div>
  );
}

export default App;





