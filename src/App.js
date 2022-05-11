import { Routes, Route } from 'react-router-dom'
// components
import PageRoom from './pages/PageRoom'
import PageMain from './pages/PageMain'



function App() {
  return (
    <div className="App">
      <Routes>
        <Route exact path="/room/:id" element={<PageRoom />} />
        <Route exact path="/" element={<PageMain />} />
      </Routes>
    </div>
  );
}

export default App;
