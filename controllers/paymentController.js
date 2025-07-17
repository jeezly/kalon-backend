const pool = require('../config/db');
const stripe = require('stripe')(sk_test_51RjOurPNL4dWw6nE4hhWKu5I6aQ8m9s53cgcdhaPSvlaMYMkFjExrj48ThKPPjVI47E5aTbMl9kNGvq0798b4aYs00g3WWLkfv);

const PaymentController = {
  // PAGO CON TARJETA (Stripe)
processStripePayment: async (req, res) => {
  const transaction = await pool.getConnection();

  try {
    await transaction.beginTransaction();

    const { paquete_id, paymentMethodId, isLaSalle } = req.body;
    const userId = req.user.id;

    // 1. Verificar paquete válido
    const [paqueteResult] = await transaction.query(
      'SELECT * FROM paquetes WHERE id = ? AND activo = 1',
      [paquete_id]
    );
    if (paqueteResult.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Paquete no encontrado' });
    }
    const paquete = paqueteResult[0];

    // 2. Verificar si el usuario es La Salle
    const [userResult] = await transaction.query(
      'SELECT es_estudiante_lasalle FROM usuarios WHERE id = ?',
      [userId]
    );
    const esLaSalle = isLaSalle || userResult[0]?.es_estudiante_lasalle === 1;

    const precioFinal = esLaSalle ? paquete.precio_lasalle : paquete.precio_normal;
    const montoCentavos = Math.round(precioFinal * 100);

    // 3. Crear PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: montoCentavos,
      currency: 'mxn',
      payment_method: paymentMethodId,
      confirm: true,
      payment_method_types: ['card'], // SOLO tarjetas, sin redireccionamiento
      description: `Compra paquete ${paquete.nombre}`,
      metadata: {
        user_id: userId,
        paquete_id: paquete_id
      }
    });

    if (paymentIntent.status !== 'succeeded') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `El pago fue rechazado. Estado: ${paymentIntent.status}`
      });
    }

    // 4. Registrar compra como pendiente
    const [compraResult] = await transaction.query(
      `INSERT INTO compras (usuario_id, paquete_id, subtotal, total, metodo_pago, estado) 
       VALUES (?, ?, ?, ?, 'tarjeta', 'pendiente')`,
      [userId, paquete_id, precioFinal, precioFinal]
    );
    const compraId = compraResult.insertId;

    // 5. Marcar como completada (esto activa el trigger y genera créditos)
    await transaction.query(
      'UPDATE compras SET estado = "completada", fecha_compra = NOW() WHERE id = ?',
      [compraId]
    );

    // 6. Registrar transacción de Stripe
    await transaction.query(
      `INSERT INTO transacciones_stripe 
       (usuario_id, compra_id, payment_intent_id, amount, currency, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        compraId,
        paymentIntent.id,
        montoCentavos,
        'mxn',
        paymentIntent.status
      ]
    );

    await transaction.commit();
    return res.status(200).json({
      success: true,
      message: 'Pago procesado con éxito. Tus créditos han sido agregados.'
    });

  } catch (error) {
    console.error('❌ Error en processStripePayment:', error);
    await transaction.rollback();
    return res.status(500).json({
      success: false,
      message: 'Error al procesar el pago',
      error: error.message
    });
  } finally {
    transaction.release();
  }
},




  // PAGOS PENDIENTES (EFECTIVO)
  getPendingPayments: async (req, res) => {
    try {
      const [payments] = await pool.query(`
        SELECT 
          pp.id,
          u.id as usuario_id,
          CONCAT(u.nombre, ' ', u.apellidos) AS nombre_completo,
          u.email,
          u.es_estudiante_lasalle,
          pp.monto,
          pp.metodo_pago,
          pp.estado,
          pp.fecha_limite,
          DATEDIFF(pp.fecha_limite, CURDATE()) AS dias_restantes,
          c.id AS compra_id,
          p.nombre AS paquete_nombre,
          p.tipo_clase,
          p.incluye_clases,
          p.vigencia_dias
        FROM pagos_pendientes pp
        JOIN compras c ON pp.compra_id = c.id
        JOIN usuarios u ON c.usuario_id = u.id
        JOIN paquetes p ON c.paquete_id = p.id
        WHERE pp.estado = 'pendiente'
        ORDER BY pp.fecha_limite ASC
      `);

      res.json({ success: true, data: payments });
    } catch (error) {
      console.error('Error en getPendingPayments:', error);
      res.status(500).json({ success: false, message: 'Error al obtener pagos pendientes' });
    }
  },

  // MARCAR COMO PAGADO (Y ASIGNAR CRÉDITOS)
markAsPaid: async (req, res) => {
  const { id } = req.params;
  const transaction = await pool.getConnection();

  try {
    await transaction.beginTransaction();

    // 1. Bloquear fila de pagos_pendientes y obtener compra_id
    const [[pago]] = await transaction.query(
      'SELECT compra_id FROM pagos_pendientes WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!pago) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Pago pendiente no encontrado' });
    }

    const compraId = pago.compra_id;

    // 2. Bloquear fila de creditos si existe
    const [creditos] = await transaction.query(
      'SELECT id FROM creditos WHERE compra_id = ? FOR UPDATE',
      [compraId]
    );

    if (creditos.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Los créditos ya fueron asignados a esta compra.'
      });
    }

    // 3. Marcar pago y compra
    await transaction.query(
      'UPDATE pagos_pendientes SET estado = "completado", fecha_completado = NOW() WHERE id = ?',
      [id]
    );
    await transaction.query(
      'UPDATE compras SET estado = "completada", fecha_compra = NOW() WHERE id = ?',
      [compraId]
    );

    // 4. Obtener info de compra y paquete
    const [[compra]] = await transaction.query(
      'SELECT usuario_id, paquete_id FROM compras WHERE id = ?',
      [compraId]
    );
    const [[paquete]] = await transaction.query(
      'SELECT incluye_clases, vigencia_dias FROM paquetes WHERE id = ?',
      [compra.paquete_id]
    );

   

    await transaction.commit();
    res.json({
      success: true,
      message: 'Pago confirmado y créditos asignados correctamente.'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error en markAsPaid:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar el pago como pagado',
      error: error.message
    });
  } finally {
    transaction.release();
  }
},


  // CANCELAR PAGO
  cancelPayment: async (req, res) => {
    const { id } = req.params;
    const transaction = await pool.getConnection();

    try {
      await transaction.beginTransaction();

      await transaction.query(
        'UPDATE pagos_pendientes SET estado = "cancelado" WHERE id = ?',
        [id]
      );

      const [payment] = await transaction.query(
        'SELECT compra_id FROM pagos_pendientes WHERE id = ?',
        [id]
      );

      if (!payment[0]) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Pago pendiente no encontrado' });
      }

      await transaction.query(
        'UPDATE compras SET estado = "cancelada" WHERE id = ?',
        [payment[0].compra_id]
      );

      await transaction.commit();
      res.json({ success: true, message: 'Pago cancelado exitosamente' });

    } catch (error) {
      await transaction.rollback();
      console.error('Error en cancelPayment:', error);
      res.status(500).json({ success: false, message: 'Error al cancelar pago' });
    } finally {
      if (transaction) transaction.release();
    }
  },

  // HISTORIAL DE PAGOS
  getPaymentHistory: async (req, res) => {
    try {
      const userId = req.user?.id || req.params.userId;

      const [payments] = await pool.query(`
        SELECT 
          c.id,
          c.fecha_compra,
          p.nombre AS paquete,
          p.tipo_clase,
          c.metodo_pago,
          c.total,
          c.estado,
          CASE 
            WHEN u.es_estudiante_lasalle = TRUE THEN 'Sí'
            ELSE 'No'
          END AS es_la_salle,
          IFNULL(ts.payment_intent_id, 'N/A') AS payment_intent_id
        FROM compras c
        JOIN paquetes p ON c.paquete_id = p.id
        JOIN usuarios u ON c.usuario_id = u.id
        LEFT JOIN transacciones_stripe ts ON c.id = ts.compra_id
        WHERE c.usuario_id = ?
        ORDER BY c.fecha_compra DESC
      `, [userId]);

      res.json({ success: true, data: payments });

    } catch (error) {
      console.error('Error en getPaymentHistory:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener historial de pagos',
        error: error.message
      });
    }
  }
};

module.exports = PaymentController;
