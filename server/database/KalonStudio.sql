-- Creación de la base de datos
DROP DATABASE IF EXISTS KalonStudio;
CREATE DATABASE KalonStudio;
USE KalonStudio;

-- Tabla de usuarios
CREATE TABLE usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL, -- Cambiado a texto plano
    genero ENUM('masculino', 'femenino', 'otro') DEFAULT 'otro',
    fecha_nacimiento DATE,
    matricula_lasalle VARCHAR(20),
    es_estudiante_lasalle BOOLEAN DEFAULT FALSE,
    rol ENUM('cliente', 'admin') DEFAULT 'cliente',
    foto_perfil VARCHAR(255) DEFAULT 'default.jpg',
    contacto_emergencia_nombre VARCHAR(100),
    contacto_emergencia_telefono VARCHAR(20),
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso DATETIME,
    verificado BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    sancionado BOOLEAN DEFAULT FALSE,
    motivo_sancion TEXT
);

-- Tabla de coaches
CREATE TABLE coaches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    foto VARCHAR(255) DEFAULT 'coach-default.jpg',
    especialidad ENUM('Reformer', 'Barre', 'Yoga') NOT NULL,
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE
);

-- Tabla de clases
CREATE TABLE clases (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre ENUM('Pilates Reformer', 'Barre', 'Yoga') NOT NULL,
    descripcion TEXT,
    imagen VARCHAR(255) DEFAULT 'clase-default.jpg',
    dificultad ENUM('principiante', 'intermedio', 'avanzado'),
    duracion_minutos INT DEFAULT 60,
    activa BOOLEAN DEFAULT TRUE
);

-- Tabla de horarios
CREATE TABLE horarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clase_id INT NOT NULL,
    coach_id INT NOT NULL,
    dia_semana ENUM('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado') NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    cupo_maximo INT DEFAULT 10,
    cupo_actual INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (clase_id) REFERENCES clases(id),
    FOREIGN KEY (coach_id) REFERENCES coaches(id),
    INDEX idx_dia_hora (dia_semana, hora_inicio)
);

-- Tabla de paquetes
CREATE TABLE paquetes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo_clase ENUM('Pilates Reformer', 'Barre', 'Yoga') NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    incluye_clases INT NOT NULL,
    vigencia_dias INT NOT NULL,
    precio_normal DECIMAL(10,2) NOT NULL,
    precio_lasalle DECIMAL(10,2) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de compras
CREATE TABLE compras (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    paquete_id INT NOT NULL,
    fecha_compra DATETIME DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM('tarjeta', 'paypal', 'efectivo', 'transferencia') NOT NULL,
    estado ENUM('pendiente', 'completada', 'cancelada') DEFAULT 'pendiente',
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (paquete_id) REFERENCES paquetes(id),
    INDEX idx_usuario_fecha (usuario_id, fecha_compra)
);

-- Tabla de créditos
CREATE TABLE creditos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    compra_id INT NOT NULL,
    clases_disponibles INT NOT NULL,
    clases_usadas INT DEFAULT 0,
    fecha_expiracion DATE NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (compra_id) REFERENCES compras(id),
    INDEX idx_expiracion (fecha_expiracion),
    INDEX idx_usuario_activo (usuario_id, activo)
);
CREATE TABLE `transacciones_stripe` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `compra_id` INT NOT NULL,
  `payment_intent_id` VARCHAR(255) NOT NULL,
  `amount` INT NOT NULL,
  `currency` VARCHAR(10) NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `fecha` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`),
  FOREIGN KEY (`compra_id`) REFERENCES `compras`(`id`)
);


-- Tabla de reservas
CREATE TABLE reservas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    horario_id INT NOT NULL,
    credito_id INT,
    fecha_reserva DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_cancelacion DATETIME,
    estado ENUM('pendiente', 'asistio', 'cancelada', 'no_show') DEFAULT 'pendiente',
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (horario_id) REFERENCES horarios(id),
    FOREIGN KEY (credito_id) REFERENCES creditos(id),
    INDEX idx_usuario_estado (usuario_id, estado),
    INDEX idx_horario_estado (horario_id, estado)
);

-- Tabla de tokens de recuperación
CREATE TABLE tokens_recuperacion (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    expiracion DATETIME NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    INDEX idx_token (token)
);

-- Tabla de configuraciones del sistema
CREATE TABLE configuraciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    editable BOOLEAN DEFAULT TRUE
);

-- Tabla de pagos pendientes
CREATE TABLE pagos_pendientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    compra_id INT NOT NULL,
    fecha_limite DATE NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM('efectivo', 'transferencia') NOT NULL,
    estado ENUM('pendiente', 'completado', 'cancelado') DEFAULT 'pendiente',
    fecha_completado DATETIME,
    FOREIGN KEY (compra_id) REFERENCES compras(id)
);



-- Insertar datos iniciales -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --- -- -- -- - -- -- --
-- Insertar datos iniciales

-- Configuraciones del sistema
INSERT INTO configuraciones (clave, valor, descripcion) VALUES
('descuento_lasalle', '0.10', 'Porcentaje de descuento base para estudiantes La Salle'),
('tiempo_cancelacion_manana', '10', 'Horas mínimas para cancelar una reserva de clase matutina'),
('tiempo_cancelacion_noche', '2', 'Horas mínimas para cancelar una reserva de clase vespertina/nocturna'),
('max_reservas_simultaneas', '6', 'Máximo de reservas activas por usuario'),
('dias_pago_pendiente', '3', 'Días para completar un pago pendiente');

-- Administrador (contraseña en texto plano)
INSERT INTO usuarios (nombre, apellidos, telefono, email, password, rol, verificado)
VALUES ('adminKaloon', 'Kalon', '4777502234', 'kalon.studio13@gmail.com', ' KalooonStudiooo2k25 ', 'admin', TRUE);

-- Usuarios de prueba jp y lolo (contraseñas en texto plano como solicitaste)
INSERT INTO usuarios (nombre, apellidos, email, password, telefono, genero, rol, verificado, es_estudiante_lasalle, matricula_lasalle) VALUES
('Jeypeeh', 'Usuario', 'jeypeeh@ejemplo.com', 'Jeypeeh1234', '1234567890', 'masculino', 'cliente', TRUE, TRUE, 'LS20240001'),
('Lolo', 'Prueba', 'lolo@ejemplo.com', 'Lolo1234', '9876543210', 'femenino', 'cliente', TRUE, FALSE, NULL);


-- Coaches de Reformer
INSERT INTO coaches (nombre, especialidad, telefono) VALUES
('Valeria Iga', 'Reformer', '5551110001'),
('Ana Pau', 'Reformer', '5551110002'),
('Camila García', 'Reformer', '5551110003'),
('Camila Bessie', 'Reformer', '5551110004'),
('Paola Vázquez', 'Reformer', '5551110005'),
('Valeria de la Torre', 'Reformer', '5551110006'),
('Liliana', 'Reformer', '5551110007');

-- Coaches de Barre
INSERT INTO coaches (nombre, especialidad, telefono) VALUES
('Sofía Ledesma', 'Barre', '5552220001'),
('Andrea Villarreal', 'Barre', '5552220002'),
('Mónica Gaytán', 'Barre', '5552220003'),
('Alexa Villatoro', 'Barre', '5552220004'),
('Rebeca Navarro', 'Barre', '5552220005'),
('Andy', 'Barre', '5552220006'),
('Karen Fernández', 'Barre', '5552220007');

-- Coaches de Yoga
INSERT INTO coaches (nombre, especialidad, telefono) VALUES
('Magaly Muciño', 'Yoga', '5553330001'),
('Mónica Villagómez', 'Yoga', '5553330002'),
('Maria Fernanda Moreno', 'Yoga', '5553330003');

-- Clases
INSERT INTO clases (nombre, dificultad) VALUES
('Pilates Reformer', 'intermedio'),
('Barre', 'principiante'),
('Yoga', 'principiante');

-- Paquetes de Pilates Reformer
INSERT INTO paquetes (tipo_clase, nombre, incluye_clases, vigencia_dias, precio_normal, precio_lasalle) VALUES
('Pilates Reformer', 'Clase suelta', 1, 7, 200.00, 200.00),
('Pilates Reformer', 'Paquete 4 clases', 4, 15, 750.00, 675.00), -- 10% descuento
('Pilates Reformer', 'Paquete 8 clases', 8, 30, 1399.00, 1231.12), -- 12% descuento
('Pilates Reformer', 'Paquete 12 clases', 12, 30, 1799.00, 1529.15), -- 15% descuento
('Pilates Reformer', 'Ilimitado', 999, 30, 2299.00, 2299.00); -- Sin descuento

-- Paquetes de Barre
INSERT INTO paquetes (tipo_clase, nombre, incluye_clases, vigencia_dias, precio_normal, precio_lasalle) VALUES
('Barre', 'Clase suelta', 1, 7, 190.00, 190.00),
('Barre', 'Paquete 4 clases', 4, 15, 730.00, 657.00), -- 10% descuento
('Barre', 'Paquete 8 clases', 8, 30, 1299.00, 1143.12), -- 12% descuento
('Barre', 'Paquete 12 clases', 12, 30, 1649.00, 1401.65), -- 15% descuento
('Barre', 'Ilimitado', 999, 30, 2149.00, 2149.00); -- Sin descuento

-- Paquetes de Yoga
INSERT INTO paquetes (tipo_clase, nombre, incluye_clases, vigencia_dias, precio_normal, precio_lasalle) VALUES
('Yoga', 'Clase suelta', 1, 7, 180.00, 180.00),
('Yoga', 'Paquete 4 clases', 4, 15, 699.00, 629.10), -- 10% descuento
('Yoga', 'Paquete 8 clases', 8, 30, 1199.00, 1055.12), -- 12% descuento
('Yoga', 'Paquete 12 clases', 12, 30, 1499.00, 1274.15), -- 15% descuento
('Yoga', 'Ilimitado', 999, 30, 1999.00, 1999.00); -- Sin descuento

-- Horarios de Pilates Reformer
INSERT INTO horarios (clase_id, coach_id, dia_semana, hora_inicio, hora_fin, cupo_maximo) VALUES
-- Lunes Reformer
(1, 1, 'Lunes', '06:00:00', '07:00:00', 10),
(1, 1, 'Lunes', '07:00:00', '08:00:00', 10),
(1, 1, 'Lunes', '08:00:00', '09:00:00', 10),
(1, 1, 'Lunes', '09:00:00', '10:00:00', 10),
(1, 1, 'Lunes', '10:00:00', '11:00:00', 10),
(1, 2, 'Lunes', '18:00:00', '19:00:00', 10),
(1, 7, 'Lunes', '19:00:00', '20:00:00', 10),
(1, 3, 'Lunes', '20:00:00', '21:00:00', 10),

-- Martes Reformer
(1, 5, 'Martes', '06:00:00', '07:00:00', 10),
(1, 5, 'Martes', '07:00:00', '08:00:00', 10),
(1, 5, 'Martes', '08:00:00', '09:00:00', 10),
(1, 5, 'Martes', '09:00:00', '10:00:00', 10),
(1, 5, 'Martes', '10:00:00', '11:00:00', 10),
(1, 3, 'Martes', '18:00:00', '19:00:00', 10),
(1, 3, 'Martes', '19:00:00', '20:00:00', 10),
(1, 3, 'Martes', '20:00:00', '21:00:00', 10),

-- Miércoles Reformer
(1, 3, 'Miércoles', '06:00:00', '07:00:00', 10),
(1, 3, 'Miércoles', '07:00:00', '08:00:00', 10),
(1, 3, 'Miércoles', '08:00:00', '09:00:00', 10),
(1, 3, 'Miércoles', '09:00:00', '10:00:00', 10),
(1, 3, 'Miércoles', '10:00:00', '11:00:00', 10),
(1, 7, 'Miércoles', '18:00:00', '19:00:00', 10),
(1, 7, 'Miércoles', '19:00:00', '20:00:00', 10),
(1, 7, 'Miércoles', '20:00:00', '21:00:00', 10),

-- Jueves Reformer (actualizado con Valeria de la Torre de 8-10)
(1, 3, 'Jueves', '06:00:00', '07:00:00', 10),
(1, 3, 'Jueves', '07:00:00', '08:00:00', 10),
(1, 6, 'Jueves', '08:00:00', '09:00:00', 10),
(1, 6, 'Jueves', '09:00:00', '10:00:00', 10),
(1, 6, 'Jueves', '10:00:00', '11:00:00', 10),
(1, 5, 'Jueves', '18:00:00', '19:00:00', 10),
(1, 5, 'Jueves', '19:00:00', '20:00:00', 10),
(1, 5, 'Jueves', '20:00:00', '21:00:00', 10),

-- Viernes Reformer
(1, 3, 'Viernes', '06:00:00', '07:00:00', 10),
(1, 3, 'Viernes', '07:00:00', '08:00:00', 10),
(1, 6, 'Viernes', '08:00:00', '09:00:00', 10),
(1, 6, 'Viernes', '09:00:00', '10:00:00', 10),
(1, 6, 'Viernes', '10:00:00', '11:00:00', 10),
(1, 7, 'Viernes', '18:00:00', '19:00:00', 10),
(1, 7, 'Viernes', '19:00:00', '20:00:00', 10),

-- Sábado Reformer
(1, 7, 'Sábado', '07:00:00', '08:00:00', 10),
(1, 4, 'Sábado', '08:00:00', '09:00:00', 10),
(1, 4, 'Sábado', '09:00:00', '10:00:00', 10),
(1, 4, 'Sábado', '10:00:00', '11:00:00', 10);

-- Horarios de Barre
INSERT INTO horarios (clase_id, coach_id, dia_semana, hora_inicio, hora_fin, cupo_maximo) VALUES
-- Lunes Barre
(2, 8, 'Lunes', '08:00:00', '09:00:00', 10),
(2, 9, 'Lunes', '09:00:00', '10:00:00', 10),
(2, 9, 'Lunes', '10:00:00', '11:00:00', 10),
(2, 10, 'Lunes', '18:00:00', '19:00:00', 10),
(2, 10, 'Lunes', '19:00:00', '20:00:00', 10),
(2, 10, 'Lunes', '20:00:00', '21:00:00', 10),

-- Martes Barre
(2, 12, 'Martes', '06:00:00', '07:00:00', 10),
(2, 10, 'Martes', '07:00:00', '08:00:00', 10),
(2, 9, 'Martes', '10:00:00', '11:00:00', 10),
(2, 11, 'Martes', '18:00:00', '19:00:00', 10),
(2, 11, 'Martes', '19:00:00', '20:00:00', 10),
(2, 8, 'Martes', '20:00:00', '21:00:00', 10),

-- Miércoles Barre
(2, 8, 'Miércoles', '08:00:00', '09:00:00', 10),
(2, 9, 'Miércoles', '09:00:00', '10:00:00', 10),
(2, 9, 'Miércoles', '10:00:00', '11:00:00', 10),
(2, 13, 'Miércoles', '18:00:00', '19:00:00', 10),
(2, 13, 'Miércoles', '19:00:00', '20:00:00', 10),
(2, 13, 'Miércoles', '20:00:00', '21:00:00', 10),

-- Jueves Barre
(2, 12, 'Jueves', '06:00:00', '07:00:00', 10),
(2, 10, 'Jueves', '07:00:00', '08:00:00', 10),
(2, 9, 'Jueves', '10:00:00', '11:00:00', 10),
(2, 14, 'Jueves', '18:00:00', '19:00:00', 10),
(2, 14, 'Jueves', '19:00:00', '20:00:00', 10),
(2, 14, 'Jueves', '20:00:00', '21:00:00', 10),

-- Viernes Barre
(2, 14, 'Viernes', '08:00:00', '09:00:00', 10),
(2, 14, 'Viernes', '09:00:00', '10:00:00', 10),
(2, 14, 'Viernes', '10:00:00', '11:00:00', 10),
(2, 10, 'Viernes', '18:00:00', '19:00:00', 10),
(2, 10, 'Viernes', '19:00:00', '20:00:00', 10),

-- Sábado Barre
(2, 11, 'Sábado', '08:00:00', '09:00:00', 10),
(2, 11, 'Sábado', '09:00:00', '10:00:00', 10);

-- Horarios de Yoga
INSERT INTO horarios (clase_id, coach_id, dia_semana, hora_inicio, hora_fin, cupo_maximo) VALUES
-- Lunes Yoga
(3, 15, 'Lunes', '06:00:00', '07:00:00', 10),
(3, 15, 'Lunes', '07:00:00', '08:00:00', 10),

-- Martes Yoga
(3, 16, 'Martes', '08:00:00', '09:00:00', 10),
(3, 16, 'Martes', '09:00:00', '10:00:00', 10),

-- Miércoles Yoga
(3, 15, 'Miércoles', '06:00:00', '07:00:00', 10),
(3, 15, 'Miércoles', '07:00:00', '08:00:00', 10),

-- Jueves Yoga
(3, 17, 'Jueves', '08:00:00', '09:00:00', 10),
(3, 17, 'Jueves', '09:00:00', '10:00:00', 10),

-- Viernes Yoga
(3, 17, 'Viernes', '06:00:00', '07:00:00', 10),
(3, 17, 'Viernes', '07:00:00', '08:00:00', 10),

-- Sábado Yoga
(3, 17, 'Sábado', '07:00:00', '08:00:00', 10);




-- Actualizar cupos en horarios
UPDATE horarios h
JOIN (
    SELECT horario_id, COUNT(*) AS reservas_activas
    FROM reservas 
    WHERE estado = 'pendiente' OR estado = 'asistio'
    GROUP BY horario_id
) r ON h.id = r.horario_id
SET h.cupo_actual = r.reservas_activas;





-- Triggers importantes -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --- -- -- -- - -- -- --

-- Trigger para actualizar cupo_actual al cancelar una reserva

-- Trigger para crear créditos al completar una compra
DELIMITER //
CREATE TRIGGER after_compra_completada
AFTER UPDATE ON compras
FOR EACH ROW
BEGIN
    -- Solo actuar si el estado cambió a completada
    IF NEW.estado = 'completada' AND OLD.estado != 'completada' THEN
        -- Insertar nuevo crédito
        INSERT INTO creditos (
            usuario_id,
            compra_id,
            clases_disponibles,
            fecha_expiracion,
            activo
        ) VALUES (
            NEW.usuario_id,
            NEW.id,
            (SELECT incluye_clases FROM paquetes WHERE id = NEW.paquete_id),
            DATE_ADD(CURDATE(), INTERVAL (SELECT vigencia_dias FROM paquetes WHERE id = NEW.paquete_id) DAY),
            TRUE
        );
    END IF;
END//
DELIMITER ;

-- Trigger para verificar créditos disponibles antes de reservar
DELIMITER //
CREATE TRIGGER before_reserva_insert
BEFORE INSERT ON reservas
FOR EACH ROW
BEGIN
    DECLARE creditos_disponibles INT;
    DECLARE max_reservas INT;
    
    -- Verificar si el usuario tiene créditos disponibles
    IF NEW.credito_id IS NOT NULL THEN
        SELECT (clases_disponibles - clases_usadas) INTO creditos_disponibles
        FROM creditos
        WHERE id = NEW.credito_id AND activo = TRUE AND fecha_expiracion >= CURDATE();
        
        IF creditos_disponibles <= 0 THEN
            SIGNAL SQLSTATE '45000' 
            SET MESSAGE_TEXT = 'El usuario no tiene créditos disponibles para esta reserva';
        END IF;
    END IF;
    
    -- Verificar límite de reservas simultáneas
    SELECT valor INTO max_reservas FROM configuraciones WHERE clave = 'max_reservas_simultaneas';
    
    IF (SELECT COUNT(*) FROM reservas WHERE usuario_id = NEW.usuario_id AND estado = 'pendiente') >= max_reservas THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'El usuario ha alcanzado el límite de reservas simultáneas';
    END IF;
    
    -- Verificar cupo disponible
    IF (SELECT cupo_actual FROM horarios WHERE id = NEW.horario_id) >= (SELECT cupo_maximo FROM horarios WHERE id = NEW.horario_id) THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'No hay cupo disponible para esta clase';
    END IF;
END//
DELIMITER ;

-- Trigger para completar pagos pendientes
DELIMITER //
CREATE TRIGGER after_pago_completado
AFTER UPDATE ON pagos_pendientes
FOR EACH ROW
BEGIN
    -- Solo actuar si el estado cambió a completado
    IF NEW.estado = 'completado' AND OLD.estado != 'completado' THEN
        -- Actualizar la compra asociada
        UPDATE compras 
        SET estado = 'completada',
            fecha_compra = NOW()
        WHERE id = NEW.compra_id;
    END IF;
END//
DELIMITER ;

-- Vistas útiles -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- --- -- -- -- - -- -- -- -- -- ---- --

-- Vista para horarios disponibles
CREATE OR REPLACE VIEW vista_horarios_disponibles AS
SELECT 
    h.id AS horario_id,
    c.id AS clase_id,
    c.nombre AS clase_nombre,
    co.id AS coach_id,
    co.nombre AS coach_nombre,
    co.especialidad AS coach_especialidad,
    h.dia_semana,
    h.hora_inicio,
    h.hora_fin,
    h.cupo_maximo,
    h.cupo_actual,
    (h.cupo_maximo - h.cupo_actual) AS cupos_disponibles,
    c.dificultad,
    c.duracion_minutos,
    CONCAT(h.dia_semana, ' ', h.hora_inicio) AS fecha_completa
FROM horarios h
JOIN clases c ON h.clase_id = c.id
JOIN coaches co ON h.coach_id = co.id
WHERE h.activo = TRUE AND c.activa = TRUE AND co.activo = TRUE;

-- Vista para créditos de usuarios
CREATE OR REPLACE VIEW vista_creditos_usuarios AS
SELECT 
    u.id AS usuario_id,
    CONCAT(u.nombre, ' ', u.apellidos) AS usuario_nombre,
    u.email,
    cr.id AS credito_id,
    p.nombre AS paquete,
    p.tipo_clase,
    cr.clases_disponibles,
    cr.clases_usadas,
    (cr.clases_disponibles - cr.clases_usadas) AS clases_restantes,
    cr.fecha_expiracion,
    DATEDIFF(cr.fecha_expiracion, CURDATE()) AS dias_restantes,
    cr.activo
FROM creditos cr
JOIN usuarios u ON cr.usuario_id = u.id
JOIN compras co ON cr.compra_id = co.id
JOIN paquetes p ON co.paquete_id = p.id
WHERE cr.activo = TRUE;

-- Vista para reporte de asistencia
CREATE OR REPLACE VIEW vista_reporte_asistencia AS
SELECT 
    r.id AS reserva_id,
    u.id AS usuario_id,
    CONCAT(u.nombre, ' ', u.apellidos) AS usuario_nombre,
    c.nombre AS clase_nombre,
    ch.nombre AS coach_nombre,
    h.dia_semana,
    h.hora_inicio,
    h.hora_fin,
    r.fecha_reserva,
    r.estado AS estado_reserva,
    CASE 
        WHEN u.es_estudiante_lasalle = TRUE THEN 'Sí'
        ELSE 'No'
    END AS es_la_salle,
    p.nombre AS paquete_comprado,
    cr.fecha_expiracion
FROM reservas r
JOIN usuarios u ON r.usuario_id = u.id
JOIN horarios h ON r.horario_id = h.id
JOIN clases c ON h.clase_id = c.id
JOIN coaches ch ON h.coach_id = ch.id
LEFT JOIN creditos cr ON r.credito_id = cr.id
LEFT JOIN compras cm ON cr.compra_id = cm.id
LEFT JOIN paquetes p ON cm.paquete_id = p.id;

-- Vista para reporte financiero
CREATE OR REPLACE VIEW vista_reporte_financiero AS
SELECT 
    co.id AS compra_id,
    co.fecha_compra,
    u.id AS usuario_id,
    CONCAT(u.nombre, ' ', u.apellidos) AS usuario_nombre,
    p.nombre AS paquete,
    p.tipo_clase,
    p.incluye_clases,
    co.subtotal,
    co.total,
    co.metodo_pago,
    CASE 
        WHEN u.es_estudiante_lasalle = TRUE THEN 'Sí'
        ELSE 'No'
    END AS es_la_salle,
    (co.subtotal - co.total) AS descuento_aplicado
FROM compras co
JOIN usuarios u ON co.usuario_id = u.id
JOIN paquetes p ON co.paquete_id = p.id
WHERE co.estado = 'completada';

-- Vista para horarios por coach
CREATE OR REPLACE VIEW vista_horarios_coach AS
SELECT 
    co.id AS coach_id,
    co.nombre AS coach_nombre,
    c.nombre AS clase_nombre,
    h.dia_semana,
    h.hora_inicio,
    h.hora_fin,
    h.cupo_maximo,
    h.cupo_actual,
    (SELECT COUNT(*) FROM reservas r WHERE r.horario_id = h.id AND r.estado = 'pendiente') AS reservas_activas
FROM horarios h
JOIN coaches co ON h.coach_id = co.id
JOIN clases c ON h.clase_id = c.id
WHERE h.activo = TRUE
ORDER BY co.nombre, h.dia_semana, h.hora_inicio;

-- Vista para historial de usuario
CREATE OR REPLACE VIEW vista_historial_usuario AS
SELECT 
    u.id AS usuario_id,
    CONCAT(u.nombre, ' ', u.apellidos) AS nombre_completo,
    u.email,
    c.id AS compra_id,
    c.fecha_compra,
    p.nombre AS paquete,
    p.tipo_clase,
    p.incluye_clases,
    c.total,
    cr.clases_disponibles,
    cr.clases_usadas,
    (cr.clases_disponibles - cr.clases_usadas) AS clases_restantes,
    cr.fecha_expiracion,
    r.id AS reserva_id,
    cl.nombre AS clase_reservada,
    h.dia_semana,
    h.hora_inicio,
    h.hora_fin,
    r.estado AS estado_reserva
FROM usuarios u
LEFT JOIN compras c ON u.id = c.usuario_id
LEFT JOIN paquetes p ON c.paquete_id = p.id
LEFT JOIN creditos cr ON c.id = cr.compra_id
LEFT JOIN reservas r ON u.id = r.usuario_id AND cr.id = r.credito_id
LEFT JOIN horarios h ON r.horario_id = h.id
LEFT JOIN clases cl ON h.clase_id = cl.id
ORDER BY u.id, c.fecha_compra DESC, r.fecha_reserva DESC;

-- Vista para pagos pendientes
CREATE OR REPLACE VIEW vista_pagos_pendientes AS
SELECT 
    pp.id AS pago_pendiente_id,
    c.id AS compra_id,
    u.id AS usuario_id,
    CONCAT(u.nombre, ' ', u.apellidos) AS usuario_nombre,
    p.nombre AS paquete,
    pp.monto,
    pp.metodo_pago,
    pp.fecha_limite,
    DATEDIFF(pp.fecha_limite, CURDATE()) AS dias_restantes,
    pp.estado AS estado_pago
FROM pagos_pendientes pp
JOIN compras c ON pp.compra_id = c.id
JOIN usuarios u ON c.usuario_id = u.id
JOIN paquetes p ON c.paquete_id = p.id
WHERE pp.estado = 'pendiente';

-- Vista para dashboard administrativo
CREATE OR REPLACE VIEW vista_dashboard_admin AS
SELECT 
    (SELECT COUNT(*) FROM usuarios WHERE rol = 'cliente' AND activo = TRUE) AS total_clientes,
    (SELECT COUNT(*) FROM usuarios WHERE es_estudiante_lasalle = TRUE AND activo = TRUE) AS clientes_lasalle,
    (SELECT COUNT(*) FROM reservas WHERE estado = 'pendiente') AS reservas_activas,
    (SELECT COUNT(*) FROM reservas WHERE estado = 'asistio' AND DATE(fecha_reserva) = CURDATE()) AS asistencias_hoy,
    (SELECT COUNT(*) FROM pagos_pendientes WHERE estado = 'pendiente') AS pagos_pendientes,
    (SELECT SUM(total) FROM compras WHERE estado = 'completada' AND DATE(fecha_compra) = CURDATE()) AS ingresos_hoy,
    (SELECT SUM(total) FROM compras WHERE estado = 'completada' AND MONTH(fecha_compra) = MONTH(CURDATE())) AS ingresos_mes_actual;

-- Vista de usuarios con todos sus datos (incluyendo contraseñas en texto plano)
CREATE OR REPLACE VIEW vista_usuarios_completos AS
SELECT 
    id,
    nombre,
    apellidos,
    telefono,
    email,
    password AS contrasena_plana,
    genero,
    fecha_nacimiento,
    matricula_lasalle,
    es_estudiante_lasalle,
    rol,
    foto_perfil,
    contacto_emergencia_nombre,
    contacto_emergencia_telefono,
    fecha_registro,
    ultimo_acceso,
    verificado,
    activo,
    sancionado,
    motivo_sancion
FROM usuarios;

-- Vista de reservas detalladas
CREATE OR REPLACE VIEW vista_reservas_detalladas AS
SELECT 
    r.id AS reserva_id,
    u.id AS usuario_id,
    CONCAT(u.nombre, ' ', u.apellidos) AS usuario_nombre,
    c.nombre AS clase_nombre,
    co.nombre AS coach_nombre,
    h.dia_semana,
    h.hora_inicio,
    h.hora_fin,
    r.fecha_reserva,
    r.fecha_cancelacion,
    r.estado AS estado_reserva,
    cr.id AS credito_id,
    p.nombre AS paquete_comprado,
    cr.fecha_expiracion,
    DATEDIFF(cr.fecha_expiracion, CURDATE()) AS dias_restantes_credito
FROM reservas r
JOIN usuarios u ON r.usuario_id = u.id
JOIN horarios h ON r.horario_id = h.id
JOIN clases c ON h.clase_id = c.id
JOIN coaches co ON h.coach_id = co.id
LEFT JOIN creditos cr ON r.credito_id = cr.id
LEFT JOIN compras cm ON cr.compra_id = cm.id
LEFT JOIN paquetes p ON cm.paquete_id = p.id;

-- Vista de clases populares
CREATE OR REPLACE VIEW vista_clases_populares AS
SELECT 
    c.id AS clase_id,
    c.nombre AS clase_nombre,
    COUNT(r.id) AS total_reservas,
    SUM(CASE WHEN r.estado = 'asistio' THEN 1 ELSE 0 END) AS asistencias,
    SUM(CASE WHEN r.estado = 'no_show' THEN 1 ELSE 0 END) AS inasistencias,
    ROUND(SUM(CASE WHEN r.estado = 'asistio' THEN 1 ELSE 0 END) / COUNT(r.id) * 100, 2) AS porcentaje_asistencia
FROM clases c
JOIN horarios h ON c.id = h.clase_id
JOIN reservas r ON h.id = r.horario_id
GROUP BY c.id, c.nombre
ORDER BY total_reservas DESC;

-- Vista de coaches con estadísticas
CREATE OR REPLACE VIEW vista_coaches_estadisticas AS
SELECT 
    co.id AS coach_id,
    co.nombre AS coach_nombre,
    co.especialidad,
    COUNT(DISTINCT h.id) AS total_clases_impartidas,
    COUNT(r.id) AS total_reservas,
    SUM(CASE WHEN r.estado = 'asistio' THEN 1 ELSE 0 END) AS asistencias,
    ROUND(SUM(CASE WHEN r.estado = 'asistio' THEN 1 ELSE 0 END) / COUNT(r.id) * 100, 2) AS porcentaje_asistencia
FROM coaches co
LEFT JOIN horarios h ON co.id = h.coach_id
LEFT JOIN reservas r ON h.id = r.horario_id
GROUP BY co.id, co.nombre, co.especialidad
ORDER BY total_clases_impartidas DESC;

-- Trigger para registrar actividad de usuarios
DELIMITER //
CREATE TRIGGER before_usuario_login
BEFORE UPDATE ON usuarios
FOR EACH ROW
BEGIN
    -- Actualizar último acceso cuando cambia la contraseña (simulando login)
    IF NEW.password != OLD.password THEN
        SET NEW.ultimo_acceso = NOW();
    END IF;
END//
DELIMITER ;

-- Trigger para verificar matrícula La Salle
DELIMITER //
CREATE TRIGGER before_usuario_lasalle_update
BEFORE UPDATE ON usuarios
FOR EACH ROW
BEGIN
    -- Verificar que si es estudiante La Salle, tenga matrícula
    IF NEW.es_estudiante_lasalle = TRUE AND (NEW.matricula_lasalle IS NULL OR NEW.matricula_lasalle = '') THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Los estudiantes La Salle deben tener una matrícula válida';
    END IF;
END//
DELIMITER ;

-- Trigger para historial de cambios en horarios
DELIMITER //
CREATE TRIGGER after_horario_update
AFTER UPDATE ON horarios
FOR EACH ROW
BEGIN
    -- Registrar cambios importantes en horarios
    IF OLD.coach_id != NEW.coach_id OR OLD.hora_inicio != NEW.hora_inicio OR OLD.hora_fin != NEW.hora_fin THEN
        INSERT INTO sistema_log (tipo, mensaje, detalle)
        VALUES ('horario', 'Horario modificado', 
                CONCAT('Horario ID ', NEW.id, ' modificado. Coach: ', OLD.coach_id, '->', NEW.coach_id, 
                       ', Horario: ', OLD.hora_inicio, '-', OLD.hora_fin, '->', NEW.hora_inicio, '-', NEW.hora_fin));
    END IF;
END//
DELIMITER ;

-- Trigger para notificar cupo lleno
DELIMITER //
CREATE TRIGGER before_horario_update_cupo
BEFORE UPDATE ON horarios
FOR EACH ROW
BEGIN
    -- Prevenir reducir el cupo máximo por debajo del cupo actual
    IF NEW.cupo_maximo < OLD.cupo_actual THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'No se puede reducir el cupo máximo por debajo del cupo actual';
    END IF;
END//
DELIMITER ;

-- Vista específica para ver usuarios con sus contraseñas (solo para administradores)
CREATE OR REPLACE VIEW vista_usuarios_contrasenas AS
SELECT 
    id,
    CONCAT(nombre, ' ', apellidos) AS nombre_completo,
    email,
    password AS contrasena,
    rol,
    es_estudiante_lasalle,
    fecha_registro,
    ultimo_acceso,
    activo
FROM usuarios
ORDER BY rol, nombre_completo;



