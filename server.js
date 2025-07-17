require('dotenv').config({ path: './server/.env' });
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const coachRoutes = require('./routes/coachRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const packageRoutes = require('./routes/packageRoutes');
const reportRoutes = require('./routes/reportRoutes');
const classRoutes = require('./routes/classRoutes');
const userRoutes = require('./routes/userRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const creditRoutes = require('./routes/creditRoutes');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('./config/db');

const app = express();



// Configuración CORS
app.use(cors({
  origin: ['http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware para parsear JSON
app.use(express.json());

// Configuración de directorios para archivos estáticos
const assetsDir = path.join(__dirname, 'assets');
const uploadsDir = path.join(__dirname, 'uploads');

// Crear directorios si no existen
[uploadsDir, assetsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
});

// Middleware para manejar FormData (para subida de imágenes)
app.use(express.urlencoded({ extended: true }));

// Rutas principales
app.use('/api/auth', authRoutes);
app.use('/api/coaches', coachRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/purchases', require('./routes/purchaseRoutes'));


// Ruta especial para actualización de perfil con imagen
app.put('/api/users/:id/profile', upload.single('foto_perfil'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, fecha_nacimiento, contacto_emergencia_nombre, contacto_emergencia_telefono } = req.body;
    
    let foto_perfil = null;
    if (req.file) {
      foto_perfil = `/uploads/${req.file.filename}`;
    }

    // Actualizar en la base de datos
    const [result] = await pool.query(
      `UPDATE usuarios SET 
      nombre = COALESCE(?, nombre),
      telefono = COALESCE(?, telefono), 
      fecha_nacimiento = COALESCE(?, fecha_nacimiento),
      contacto_emergencia_nombre = COALESCE(?, contacto_emergencia_nombre),
      contacto_emergencia_telefono = COALESCE(?, contacto_emergencia_telefono),
      foto_perfil = COALESCE(?, foto_perfil)
      WHERE id = ?`,
      [
        nombre,
        telefono,
        fecha_nacimiento,
        contacto_emergencia_nombre,
        contacto_emergencia_telefono,
        foto_perfil,
        id
      ]
    );

    // Obtener usuario actualizado
    const [user] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    
    // No devolver la contraseña
    delete user[0].password;

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: user[0]
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el perfil',
      error: error.message
    });
  }
});

// Servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/assets', express.static(assetsDir));

// Middleware para manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Manejar errores de Multer (subida de archivos)
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ 
      success: false,
      message: 'Error al subir el archivo',
      error: err.message
    });
  } else if (err) {
    return res.status(500).json({ 
      success: false,
      message: 'Algo salió mal en el servidor',
      error: err.message
    });
  }
  
  next();
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});