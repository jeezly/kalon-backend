const pool = require('../config/db');

const Coach = {
  /**
   * Obtiene todos los coaches activos
   */
  getAllActive: async () => {
    try {
      const [rows] = await pool.query('SELECT * FROM coaches WHERE activo = TRUE ORDER BY nombre');
      return rows;
    } catch (error) {
      console.error('Error en getAllActive:', error);
      throw error;
    }
  },

  /**
   * Obtiene todos los coaches (activos e inactivos)
   */
  getAll: async () => {
    try {
      const [rows] = await pool.query('SELECT * FROM coaches ORDER BY nombre');
      return rows;
    } catch (error) {
      console.error('Error en getAll:', error);
      throw error;
    }
  },

  /**
   * Obtiene coaches por especialidad
   * @param {string} specialty - Especialidad a filtrar
   */
  getBySpecialty: async (specialty) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
        id, 
        nombre, 
        CASE 
          WHEN foto IS NOT NULL THEN CONCAT('/uploads/coaches/', foto)
          ELSE '/assets/images/coach-default.png'
        END as foto, 
        especialidad, 
        activo 
      FROM coaches 
      WHERE especialidad = ? AND activo = TRUE 
      ORDER BY nombre`,
      [specialty]
    );
    return rows;
  } catch (error) {
    console.error('Error en getBySpecialty:', error);
    throw error;
  }
},

  /**
   * Obtiene un coach por ID
   * @param {number} id - ID del coach
   */
  getById: async (id) => {
    try {
      const [rows] = await pool.query('SELECT * FROM coaches WHERE id = ?', [id]);
      if (rows.length === 0) {
        throw new Error('Coach no encontrado');
      }
      return rows[0];
    } catch (error) {
      console.error('Error en getById:', error);
      throw error;
    }
  },

  /**
   * Crea un nuevo coach
   * @param {string} nombre - Nombre del coach
   * @param {string} foto - Nombre del archivo de foto
   * @param {string} especialidad - Especialidad del coach
   */
  create: async (nombre, foto, especialidad) => {
    try {
      const [result] = await pool.query(
        'INSERT INTO coaches (nombre, foto, especialidad) VALUES (?, ?, ?)',
        [nombre, foto || 'coach-default.jpg', especialidad]
      );
      return result.insertId;
    } catch (error) {
      console.error('Error en create:', error);
      throw error;
    }
  },

  /**
   * Actualiza un coach existente
   * @param {number} id - ID del coach a actualizar
   * @param {string} nombre - Nuevo nombre
   * @param {string|null} foto - Nueva foto (opcional)
   * @param {string} especialidad - Nueva especialidad
   * @param {boolean} activo - Estado activo/inactivo
   */
  update: async (id, nombre, foto, especialidad, activo) => {
  try {
    // Construir la consulta SQL dinámicamente
    const updates = [];
    const params = [];
    
    if (nombre !== undefined && nombre !== null) {
      updates.push('nombre = ?');
      params.push(nombre);
    }
    
    if (foto !== undefined && foto !== null) {
      updates.push('foto = ?');
      params.push(foto);
    }
    
    if (especialidad !== undefined && especialidad !== null) {
      updates.push('especialidad = ?');
      params.push(especialidad);
    }
    
    if (activo !== undefined && activo !== null) {
      updates.push('activo = ?');
      params.push(activo);
    }
    
    if (updates.length === 0) {
      throw new Error('No se proporcionaron campos para actualizar');
    }
    
    params.push(id);
    
    const query = `UPDATE coaches SET ${updates.join(', ')} WHERE id = ?`;
    await pool.query(query, params);
    
    // Obtener y devolver el coach actualizado
    const [rows] = await pool.query('SELECT * FROM coaches WHERE id = ?', [id]);
    if (rows.length === 0) {
      throw new Error('Coach no encontrado después de actualizar');
    }
    
    return rows[0];
  } catch (error) {
    console.error('Error en update:', error);
    throw error;
  }
},

  /**
   * Desactiva un coach (cambia estado activo a false)
   * @param {number} id - ID del coach a desactivar
   */
  deactivate: async (id) => {
    try {
      await pool.query('UPDATE coaches SET activo = FALSE WHERE id = ?', [id]);
      return await Coach.getById(id);
    } catch (error) {
      console.error('Error en deactivate:', error);
      throw error;
    }
  },

  /**
   * Reactiva un coach (cambia estado activo a true)
   * @param {number} id - ID del coach a reactivar
   */
  reactivate: async (id) => {
    try {
      await pool.query('UPDATE coaches SET activo = TRUE WHERE id = ?', [id]);
      return await Coach.getById(id);
    } catch (error) {
      console.error('Error en reactivate:', error);
      throw error;
    }
  },

  /**
   * Elimina permanentemente un coach de la base de datos
   * @param {number} id - ID del coach a eliminar
   */
  delete: async (id) => {
    try {
      const coach = await Coach.getById(id);
      await pool.query('DELETE FROM coaches WHERE id = ?', [id]);
      return coach; // Devuelve el coach eliminado
    } catch (error) {
      console.error('Error en delete:', error);
      throw error;
    }
  },

  /**
   * Verifica si un coach tiene clases asignadas
   * @param {number} id - ID del coach
   */
  hasAssignedClasses: async (id) => {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM horarios WHERE coach_id = ?',
        [id]
      );
      return rows[0].count > 0;
    } catch (error) {
      console.error('Error en hasAssignedClasses:', error);
      throw error;
    }
  }
};

module.exports = Coach;