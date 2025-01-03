import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SurveyHandler from './api/surveyApi';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/survey-results" element={<SurveyHandler />} />
      </Routes>
    </Router>
  );
}

export default App;
