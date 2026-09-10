import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes.jsx';
import {AuthProvider} from './context/AuthContext.jsx';

function App() {
  return (
    <BrowserRouter>
   <AuthProvider>
    <AppRoutes />
    
   </AuthProvider>
    </BrowserRouter>
  );
}
export default App;
