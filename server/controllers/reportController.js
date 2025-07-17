const pool = require('../config/db');

const ReportController = {
  getDashboardStats: async (req, res) => {
    try {
      const [reservationsToday] = await pool.query(`SELECT COUNT(*) as count FROM reservas WHERE DATE(fecha_reserva) = CURDATE()`);
      const [monthlyIncome] = await pool.query(`SELECT SUM(total) as total FROM compras WHERE estado = 'completada' AND MONTH(fecha_compra) = MONTH(CURDATE())`);
      const [newClients] = await pool.query(`SELECT COUNT(*) as count FROM usuarios WHERE rol = 'cliente' AND DATE(fecha_registro) = CURDATE()`);
      const [activeClasses] = await pool.query(`SELECT COUNT(*) as count FROM horarios WHERE activo = TRUE`);
      
      res.json({
        success: true,
        data: {
          reservationsToday: reservationsToday[0].count,
          monthlyIncome: monthlyIncome[0].total || 0,
          newClients: newClients[0].count,
          activeClasses: activeClasses[0].count
        }
      });
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener estadísticas' 
      });
    }
  },
  
  getRecentReservations: async (req, res) => {
    try {
      const [reservations] = await pool.query(
        `SELECT r.id, CONCAT(u.nombre, ' ', u.apellidos) as usuario_nombre, 
         c.nombre as clase_nombre, ch.nombre as coach_nombre,
         r.fecha_reserva, h.hora_inicio, r.estado
         FROM reservas r
         JOIN usuarios u ON r.usuario_id = u.id
         JOIN horarios h ON r.horario_id = h.id
         JOIN clases c ON h.clase_id = c.id
         JOIN coaches ch ON h.coach_id = ch.id
         ORDER BY r.fecha_reserva DESC
         LIMIT 5`
      );
      
      res.json({
        success: true,
        data: reservations
      });
    } catch (error) {
      console.error('Error getting recent reservations:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener reservaciones recientes' 
      });
    }
  },
   getFinancialReport: async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Valores por defecto para el rango de fechas
    const effectiveStartDate = startDate || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
    const effectiveEndDate = endDate || new Date().toISOString().split('T')[0];

    const [incomeByPackage] = await pool.query(`
      SELECT p.nombre as package, SUM(c.total) as income
      FROM compras c
      JOIN paquetes p ON c.paquete_id = p.id
      WHERE c.estado = 'completada'
      AND c.fecha_compra BETWEEN ? AND ?
      GROUP BY p.nombre
    `, [effectiveStartDate, effectiveEndDate]);

    const [paymentMethods] = await pool.query(`
      SELECT metodo_pago as method, COUNT(*) as count
      FROM compras
      WHERE estado = 'completada'
      AND fecha_compra BETWEEN ? AND ?
      GROUP BY metodo_pago
    `, [effectiveStartDate, effectiveEndDate]);

    const [monthlyIncome] = await pool.query(`
      SELECT 
        DATE_FORMAT(fecha_compra, '%Y-%m') as month,
        SUM(total) as income
      FROM compras
      WHERE estado = 'completada'
      AND fecha_compra BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(fecha_compra, '%Y-%m')
      ORDER BY month
    `, [effectiveStartDate, effectiveEndDate]);

    // Estructura de respuesta garantizada
    res.json({
      success: true,
      data: {
        financial: {
          incomeByPackage: incomeByPackage || [],
          paymentMethods: paymentMethods || [],
          monthlyIncome: monthlyIncome || []
        }
      }
    });
  } catch (error) {
    console.error('Error getting financial report:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener reporte financiero',
      data: {
        financial: {
          incomeByPackage: [],
          paymentMethods: [],
          monthlyIncome: []
        }
      }
    });
  }
},
  getAttendanceReport: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Asistencia por clase
      const [attendanceByClass] = await pool.query(`
        SELECT 
          c.nombre as class,
          SUM(CASE WHEN r.estado = 'asistio' THEN 1 ELSE 0 END) as attendance,
          SUM(CASE WHEN r.estado = 'no_show' THEN 1 ELSE 0 END) as noShow
        FROM reservas r
        JOIN horarios h ON r.horario_id = h.id
        JOIN clases c ON h.clase_id = c.id
        WHERE r.fecha_reserva BETWEEN ? AND ?
        GROUP BY c.nombre
      `, [startDate, endDate]);

      // Asistencia por coach
      const [attendanceByCoach] = await pool.query(`
        SELECT 
          co.nombre as coach,
          ROUND(
            SUM(CASE WHEN r.estado = 'asistio' THEN 1 ELSE 0 END) / 
            COUNT(*) * 100, 2
          ) as attendanceRate
        FROM reservas r
        JOIN horarios h ON r.horario_id = h.id
        JOIN coaches co ON h.coach_id = co.id
        WHERE r.fecha_reserva BETWEEN ? AND ?
        GROUP BY co.nombre
      `, [startDate, endDate]);

      res.json({
        success: true,
        data: {
          attendanceByClass,
          attendanceByCoach
        }
      });
    } catch (error) {
      console.error('Error getting attendance report:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener reporte de asistencia' 
      });
    }
  },

  getUserActivityReport: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Usuarios activos vs inactivos
      const [activeUsers] = await pool.query(`
        SELECT COUNT(*) as count
        FROM usuarios
        WHERE rol = 'cliente'
        AND activo = TRUE
      `);
      
      const [inactiveUsers] = await pool.query(`
        SELECT COUNT(*) as count
        FROM usuarios
        WHERE rol = 'cliente'
        AND activo = FALSE
      `);

      // Nuevos registros
      const [newRegistrations] = await pool.query(`
        SELECT 
          DATE_FORMAT(fecha_registro, '%Y-%m') as month,
          COUNT(*) as count
        FROM usuarios
        WHERE rol = 'cliente'
        AND fecha_registro BETWEEN ? AND ?
        GROUP BY DATE_FORMAT(fecha_registro, '%Y-%m')
        ORDER BY month
      `, [startDate, endDate]);

      // Estudiantes La Salle vs regulares
      const [laSalleStudents] = await pool.query(`
        SELECT COUNT(*) as count
        FROM usuarios
        WHERE rol = 'cliente'
        AND es_estudiante_lasalle = TRUE
      `);
      
      const [regularStudents] = await pool.query(`
        SELECT COUNT(*) as count
        FROM usuarios
        WHERE rol = 'cliente'
        AND es_estudiante_lasalle = FALSE
      `);

      res.json({
        success: true,
        data: {
          activeUsers: activeUsers[0].count,
          inactiveUsers: inactiveUsers[0].count,
          newRegistrations,
          laSalleStudents: laSalleStudents[0].count,
          regularStudents: regularStudents[0].count
        }
      });
    } catch (error) {
      console.error('Error getting user activity report:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener reporte de actividad de usuarios' 
      });
    }
  }
};

module.exports = ReportController;
