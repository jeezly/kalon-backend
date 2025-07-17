const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'KalonStudioSecretKey2023';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class AuthController {
static async login(req, res) {
  try {
    const { email, password } = req.body;
    
    console.log('Intento de login con:', { email, password: password?.trim() });

    // 1. Buscar usuario
    const [users] = await pool.query(
      `SELECT id, nombre, email, password, rol, verificado 
       FROM usuarios WHERE email = ? LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      console.log('Usuario no encontrado');
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales incorrectas' 
      });
    }

    const user = users[0];
    console.log('Usuario encontrado:', { 
      email: user.email, 
      storedPassword: user.password?.trim(), 
      receivedPassword: password?.trim() 
    });
    
    // 2. Comparación segura de contraseñas (evitando problemas con espacios)
    if (password?.trim() !== user.password?.trim()) {
      console.log('Contraseña incorrecta');
      console.log(`Comparación fallida: 
        Recibida: "${password?.trim()}" 
        Almacenada: "${user.password?.trim()}"`);
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales incorrectas' 
      });
    }

    // 3. Verificar si la cuenta está activa
    if (!user.verificado) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta no verificada'
      });
    }

    // 4. Generar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        rol: user.rol 
      }, 
      process.env.JWT_SECRET || 'KalonStudioSecretKey2023',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    console.log('Token generado:', token);

    // 5. Actualizar último acceso
    await pool.query(
      'UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?',
      [user.id]
    );

    // 6. Enviar respuesta completa
    return res.json({ 
      success: true,
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor' 
    });
  }
}

  static async register(req, res) {
    try {
      const { nombre, apellidos, email, password, telefono, genero, fecha_nacimiento, es_estudiante_lasalle, matricula_lasalle, acepto_aviso } = req.body;

      if (!nombre || !apellidos || !email || !password || !telefono || !acepto_aviso) {
        return res.status(400).json({ 
          success: false, 
          message: 'Completa todos los campos obligatorios' 
        });
      }

      // Verificar si el correo ya existe
      const [existingUsers] = await pool.query(
        'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
        [email]
      );
      
      if (existingUsers.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'El correo ya está registrado' 
        });
      }

      // Insertar nuevo usuario con contraseña en texto plano
      const [result] = await pool.query(
        `INSERT INTO usuarios 
        (nombre, apellidos, email, password, telefono, genero, rol, verificado) 
        VALUES (?, ?, ?, ?, ?, ?, 'cliente', TRUE)`,
        [nombre, apellidos, email, password, telefono, genero]
      );

      // Actualizar campos adicionales si es necesario
      if (fecha_nacimiento || es_estudiante_lasalle || matricula_lasalle) {
        await pool.query(
          `UPDATE usuarios SET 
          fecha_nacimiento = ?,
          es_estudiante_lasalle = ?,
          matricula_lasalle = ?
          WHERE id = ?`,
          [fecha_nacimiento, es_estudiante_lasalle, matricula_lasalle, result.insertId]
        );
      }

      // Generar token JWT
      const token = jwt.sign(
        { 
          id: result.insertId, 
          email: email, 
          rol: 'cliente' 
        }, 
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({ 
        success: true, 
        token, 
        user: { 
          id: result.insertId, 
          nombre: nombre, 
          email: email, 
          rol: 'cliente' 
        } 
      });
    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al registrar usuario' 
      });
    }
  }

  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          success: false, 
          message: 'Proporciona tu correo electrónico' 
        });
      }

      const [users] = await pool.query(
        'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
        [email]
      );
      
      if (users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'No se encontró una cuenta con ese correo' 
        });
      }

      const user = users[0];
      const token = uuidv4();
      const expiracion = new Date(Date.now() + 3600000); // 1 hora

      await pool.query(
        'INSERT INTO tokens_recuperacion (usuario_id, token, expiracion) VALUES (?, ?, ?)',
        [user.id, token, expiracion]
      );

      console.log(`Token de recuperación para ${email}: ${token}`);
      
      res.json({ 
        success: true, 
        message: 'Se ha enviado un enlace de recuperación a tu correo' 
      });
    } catch (error) {
      console.error('Error en forgotPassword:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al procesar la solicitud' 
      });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ 
          success: false, 
          message: 'Token y nueva contraseña son requeridos' 
        });
      }

      const [tokens] = await pool.query(
        'SELECT * FROM tokens_recuperacion WHERE token = ? AND usado = FALSE AND expiracion > NOW()',
        [token]
      );

      if (tokens.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Token inválido o expirado' 
        });
      }

      const tokenRecord = tokens[0];
      
      // Actualizar contraseña en texto plano
      await pool.query(
        'UPDATE usuarios SET password = ? WHERE id = ?',
        [newPassword, tokenRecord.usuario_id]
      );

      await pool.query(
        'UPDATE tokens_recuperacion SET usado = TRUE WHERE id = ?',
        [tokenRecord.id]
      );

      res.json({ 
        success: true, 
        message: 'Contraseña actualizada exitosamente' 
      });
    } catch (error) {
      console.error('Error en resetPassword:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al restablecer la contraseña' 
      });
    }
  }

  static async verifyToken(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Acceso no autorizado' 
        });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      
      const [users] = await pool.query(
        'SELECT * FROM usuarios WHERE id = ? LIMIT 1',
        [decoded.id]
      );
      
      if (users.length === 0) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuario no encontrado' 
        });
      }

      req.user = users[0];
      next();
    } catch (error) {
      console.error('Error en verifyToken:', error);
      res.status(401).json({ 
        success: false, 
        message: 'Token inválido o expirado' 
      });
    }
  }

  static async checkAdmin(req, res, next) {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Acceso denegado: se requieren privilegios de administrador' 
      });
    }
    next();
  }
}

module.exports = AuthController;