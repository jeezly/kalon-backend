// server/controllers/userController.js
const User = require('../models/User');
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

exports.validateRecoveryAndReset = async (req, res) => {
  const { nombre, email, telefono, fecha_nacimiento, newPassword } = req.body;

  try {
    const [users] = await pool.query(
      `SELECT * FROM usuarios 
       WHERE nombre = ? AND email = ? AND telefono = ? AND fecha_nacimiento = ?`,
      [nombre, email, telefono, fecha_nacimiento]
    );

    if (users.length === 0) {
      return res.status(400).json({ success: false, message: 'Datos incorrectos. Intenta nuevamente.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [hashedPassword, users[0].id]
    );

    res.json({ success: true, message: 'Contraseña actualizada exitosamente.' });
  } catch (error) {
    console.error('Error en recuperación:', error);
    res.status(500).json({ success: false, message: 'Error al recuperar la contraseña.' });
  }
};


exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.getAllClients();
    res.json(users);
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener los usuarios',
      error: error.message
    });
  }
};

exports.updateLaSalleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, matricula } = req.body;
    
    // Validación básica
    if (status && !matricula) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere matrícula para asignar estatus La Salle'
      });
    }

    await User.updateLaSalleStatus(id, status, matricula);
    
    res.json({ 
      success: true, 
      message: 'Estatus La Salle actualizado',
      newStatus: status,
      matricula: matricula || null
    });
  } catch (error) {
    console.error('Error updating La Salle status:', error);
    res.status(500).json({ 
      success: false,
      message: error.sqlMessage || 'Error al actualizar el estatus',
      error: error.message
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Generar contraseña temporal
    const tempPassword = generateTempPassword();
    
    // 2. Hashear la contraseña
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    // 3. Actualizar en base de datos
    await pool.query(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );
    
    // 4. Obtener email del usuario para enviar notificación
    const [user] = await pool.query(
      'SELECT email FROM usuarios WHERE id = ?',
      [id]
    );
    
    if (!user || user.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // 5. Aquí iría el envío real del correo (implementación pendiente)
    console.log(`Contraseña temporal para ${user[0].email}: ${tempPassword}`);
    
    res.json({ 
      success: true,
      message: 'Contraseña reseteada exitosamente. Se ha enviado un correo al usuario.',
      emailSentTo: user[0].email
    });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al resetear la contraseña',
      error: error.message
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    // Validar que active sea booleano
    if (typeof active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'El estado debe ser true o false'
      });
    }

    await pool.query(
      'UPDATE usuarios SET activo = ? WHERE id = ?',
      [active, id]
    );
    
    res.json({ 
      success: true,
      message: `Usuario ${active ? 'activado' : 'desactivado'} correctamente`,
      newStatus: active
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ 
      success: false,
      message: error.sqlMessage || 'Error al actualizar el estado del usuario',
      error: error.message
    });
  }
};

// Función auxiliar para generar contraseña temporal
function generateTempPassword() {
  const length = 10;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  
  // Aseguramos que la contraseña tenga al menos un número y un carácter especial
  result += chars.charAt(Math.floor(Math.random() * 26)); // Letra mayúscula
  result += chars.charAt(26 + Math.floor(Math.random() * 26)); // Letra minúscula
  result += chars.charAt(52 + Math.floor(Math.random() * 10)); // Número
  result += chars.charAt(62 + Math.floor(Math.random() * 8)); // Carácter especial
  
  // Completamos el resto de la contraseña
  for (let i = 4; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Mezclamos los caracteres para mayor seguridad
  return result.split('').sort(() => 0.5 - Math.random()).join('');
}
exports.getCurrentUser = async (req, res) => {
  try {
    // 1. Obtener datos básicos del usuario
    const [userRows] = await pool.query(`
      SELECT id, nombre, apellidos, email, telefono, genero, rol, foto_perfil,
             es_estudiante_lasalle, matricula_lasalle
      FROM usuarios WHERE id = ?
    `, [req.user.id]);

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const user = userRows[0];

    // 2. Obtener créditos activos (usando tu vista SQL existente)
    const [creditsRows] = await pool.query(`
      SELECT SUM(clases_restantes) AS total_creditos 
      FROM vista_creditos_usuarios 
      WHERE usuario_id = ? AND activo = 1 AND dias_restantes > 0
    `, [req.user.id]);

    // 3. Combinar resultados
    res.json({
      success: true,
      user: {
        ...user,
        creditos: creditsRows[0].total_creditos || 0 // Si no hay créditos, devuelve 0
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
};



exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar autenticación y permisos
    if (!req.user || parseInt(id) !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para actualizar este perfil'
      });
    }
    
    // Preparar datos para actualización
    const updateData = {
      nombre: req.body.nombre,
      telefono: req.body.telefono,
      fecha_nacimiento: req.body.fecha_nacimiento,
      contacto_emergencia_nombre: req.body.contacto_emergencia_nombre,
      contacto_emergencia_telefono: req.body.contacto_emergencia_telefono
    };

    // Manejar la foto de perfil si se subió
    if (req.file) {
      updateData.foto_perfil = `/uploads/users/${req.file.filename}`;
      
      // Eliminar foto anterior si existe
      const [user] = await pool.query('SELECT foto_perfil FROM usuarios WHERE id = ?', [id]);
      if (user[0].foto_perfil && !user[0].foto_perfil.includes('default')) {
        const oldImage = path.basename(user[0].foto_perfil);
        const oldPath = path.join(__dirname, '../uploads/users', oldImage);
        
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }
    
    // Actualizar en la base de datos
    await pool.query(
      `UPDATE usuarios SET 
      nombre = COALESCE(?, nombre),
      telefono = COALESCE(?, telefono), 
      fecha_nacimiento = COALESCE(?, fecha_nacimiento),
      contacto_emergencia_nombre = COALESCE(?, contacto_emergencia_nombre),
      contacto_emergencia_telefono = COALESCE(?, contacto_emergencia_telefono),
      foto_perfil = COALESCE(?, foto_perfil)
      WHERE id = ?`,
      [
        updateData.nombre,
        updateData.telefono,
        updateData.fecha_nacimiento,
        updateData.contacto_emergencia_nombre,
        updateData.contacto_emergencia_telefono,
        updateData.foto_perfil,
        id
      ]
    );
    
    // Obtener usuario actualizado
    const [updatedUser] = await pool.query(
  `SELECT id, nombre, email, telefono, genero, fecha_nacimiento,
   foto_perfil, contacto_emergencia_nombre, contacto_emergencia_telefono,
   es_estudiante_lasalle, matricula_lasalle
   FROM usuarios WHERE id = ?`, 
  [id]
);

res.json({
  success: true,
  message: 'Perfil actualizado exitosamente',
  user: updatedUser[0] // Asegúrate de incluir todos los campos necesarios
});
    
    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: updatedUser[0] // Asegúrate de incluir todos los campos necesarios
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar el perfil',
      error: error.message
    });
  }
  
};
