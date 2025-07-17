const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const verifyAdmin = async (req, res, next) => {
  try {
    // Obtener el token del header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No hay token, autorización denegada' });
    }

    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar al usuario en la base de datos
    const [user] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [decoded.id]);
    
    if (!user || user.length === 0) {
      return res.status(401).json({ message: 'Token no válido - usuario no encontrado' });
    }

    // Verificar si es admin
    if (user[0].rol !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado - se requieren privilegios de admin' });
    }

    // Añadir el usuario al request para usarlo en las rutas
    req.user = user[0];
    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({ message: 'Error en el servidor al verificar autenticación' });
  }
  
};
const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No hay token, autorización denegada' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const [user] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [decoded.id]);
    
    if (!user || user.length === 0) {
      return res.status(401).json({ message: 'Token no válido - usuario no encontrado' });
    }

    req.user = user[0];
    next();
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({ message: 'Error en el servidor al verificar autenticación' });
  }
};


module.exports = { 
  verifyToken,
  verifyAdmin 
};