import React, { useEffect, useState } from "react";
import "./OutputContainer.css";
import { fetchSurveyResults } from "../api/surveyApi"; // API 함수 가져오기

function OutputContainer() {
    const [output, setOutput] = useState("");

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const results = await fetchSurveyResults();
                setOutput(results.result || "결과 없음");
            } catch (error) {
                setOutput("결과를 가져오는 중 오류 발생");
            }
        };

        fetchResults();
    }, []);

    return (
        <div className="container">
            <h2>Output</h2>
            <p>{output}</p>
        </div>
    );
}

export default OutputContainer;
