import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await axios.post('https://plattform-mj.onrender.com/api/auth/login', { email, password });
    const token = res.data.token;
    const userData = res.data.user;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);

    if (userData.role === 'honorarkraft') {
      try {
        const profil = await axios.get('https://plattform-mj.onrender.com/api/profil', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const updatedUser = { ...userData, profil_komplett: profil.data.profil_komplett };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        if (!profil.data.profil_komplett) {
          return { ...updatedUser, needsProfil: true };
        }
        return updatedUser;
      } catch (e) {
        return { ...userData, needsProfil: true };
      }
    }
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
