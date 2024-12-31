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

import React, {useEffect, useState} from 'react';
import axios from 'axios';

function App() {
   const [data, setData] = useState('')

    useEffect(() => {
        axios.get('/api/data')
        .then(res => setData(res.data))
        .catch(err => console.log(err))
    }, []);

    return (
        <div>
            받아온 값 : {data}
        </div>
    );
}

export default App;