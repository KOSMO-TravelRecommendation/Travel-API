import React from "react";
import "./InputContainer.css";
import { submitSurvey } from "../api/surveyApi"; // API 함수 가져오기

function InputContainer({ inputResults, setInputResults, onSubmit, setStatus }) {
    const handleChange = (e, index) => {
        const updatedResults = [...inputResults];
        updatedResults[index] = e.target.value;
        setInputResults(updatedResults);

        if (updatedResults.every((value) => value.trim() !== "")) {
            handleSubmit(updatedResults);
        }
    };

    const handleSubmit = async (inputs) => {
        setStatus("결과를 전송 중입니다...");
        try {
            const response = await submitSurvey(inputs);
            onSubmit(response.result); // 결과 전달
            setStatus("결과를 성공적으로 받았습니다!");
        } catch (error) {
            setStatus(`오류 발생: ${error.message}`);
        }
    };

    return (
        <div className="container">
            <h2>Input</h2>
            {inputResults.map((value, index) => (
                <input
                    key={index}
                    type="text"
                    placeholder={`질문 ${index + 1}`}
                    value={value}
                    onChange={(e) => handleChange(e, index)}
                />
            ))}
        </div>
    );
}

export default InputContainer;
