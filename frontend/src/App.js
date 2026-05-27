import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Unterschreiben from './pages/Unterschreiben';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Schueler from './pages/Schueler';
import Stunden from './pages/Stunden';
import Lehrkraefte from './pages/Lehrkraefte';
import Abrechnung from './pages/Abrechnung';
import Freischaltung from './pages/Freischaltung';
import ProfilEinrichten from './pages/ProfilEinrichten';
import Impressum from './pages/Impressum';
import Hilfe from './pages/Hilfe';
import Datenschutz from './pages/Datenschutz';
import MeinProfil from './pages/MeinProfil';
import AdminProfil from './pages/AdminProfil';
import BUTAntraege from './pages/BUTAntraege';
import Abwesenheiten from './pages/Abwesenheiten';
import Kalender from './pages/Kalender';
import './index.css';

const PrivateRoute = ({ children, adminOnly }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Nunito,sans-serif',color:'var(--purple)'}}>Lädt...</div>;
  if (!user) return <Navigate to="/login"/>;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/meine-stunden"/>;
  return children;
};

const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div style={{display:'flex',minHeight:'100vh',position:'relative'}}>
      {/* Hamburger - nur Mobile */}
      <button
        onClick={()=>setSidebarOpen(true)}
        style={{position:'fixed',top:12,left:12,zIndex:1001,background:'#2d2040',color:'white',border:'none',borderRadius:8,padding:'8px 12px',fontSize:20,cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.3)',display:'none'}}
        className="hamburger-btn">☰</button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          onClick={()=>setSidebarOpen(false)}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:999}}/>
      )}

      {/* Sidebar */}
      <div style={{position:'fixed',top:0,left:0,bottom:0,zIndex:1000,transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',transition:'transform 0.3s ease',width:260,background:'#2d2040'}} className="mobile-sidebar">
        <Sidebar onClose={()=>setSidebarOpen(false)}/>
      </div>

      {/* Desktop Sidebar */}
      <div className="desktop-sidebar">
        <Sidebar/>
      </div>

      {/* Content */}
      <main className="main-content">{children}</main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login/>}/>
          <Route path="/unterschreiben/:token" element={<Unterschreiben/>}/>
          <Route path="/impressum" element={<Impressum/>}/>
          <Route path="/hilfe" element={<PrivateRoute><AppLayout><Hilfe/></AppLayout></PrivateRoute>}/>
          <Route path="/datenschutz" element={<Datenschutz/>}/>
          <Route path="/register" element={<Register/>}/>
          <Route path="/profil-einrichten" element={<ProfilEinrichten/>}/>
          <Route path="/dashboard" element={<PrivateRoute><AppLayout><Dashboard/></AppLayout></PrivateRoute>}/>
          <Route path="/schueler" element={<PrivateRoute adminOnly><AppLayout><Schueler/></AppLayout></PrivateRoute>}/>
          <Route path="/lehrkraefte" element={<PrivateRoute adminOnly><AppLayout><Lehrkraefte/></AppLayout></PrivateRoute>}/>
          <Route path="/stunden" element={<PrivateRoute adminOnly><AppLayout><Stunden adminView/></AppLayout></PrivateRoute>}/>
          <Route path="/abrechnung" element={<PrivateRoute adminOnly><AppLayout><Abrechnung/></AppLayout></PrivateRoute>}/>
          <Route path="/freischaltung" element={<PrivateRoute adminOnly><AppLayout><Freischaltung/></AppLayout></PrivateRoute>}/>
          <Route path="/but" element={<PrivateRoute><AppLayout><BUTAntraege/></AppLayout></PrivateRoute>}/>
          <Route path="/abwesenheiten" element={<PrivateRoute><AppLayout><Abwesenheiten/></AppLayout></PrivateRoute>}/>
          <Route path="/kalender" element={<PrivateRoute><AppLayout><Kalender/></AppLayout></PrivateRoute>}/>
          <Route path="/meine-stunden" element={<PrivateRoute><AppLayout><Stunden/></AppLayout></PrivateRoute>}/>
          <Route path="/meine-schueler" element={<PrivateRoute><AppLayout><Schueler readOnly/></AppLayout></PrivateRoute>}/>
          <Route path="/mein-guthaben" element={<PrivateRoute><AppLayout><Abrechnung/></AppLayout></PrivateRoute>}/>
          <Route path="/admin-profil" element={<PrivateRoute adminOnly><AppLayout><AdminProfil/></AppLayout></PrivateRoute>}/>
          <Route path="/mein-profil" element={<PrivateRoute><AppLayout><MeinProfil/></AppLayout></PrivateRoute>}/>
          <Route path="*" element={<Navigate to="/login"/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
