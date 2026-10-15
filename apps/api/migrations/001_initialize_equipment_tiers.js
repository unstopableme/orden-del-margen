exports.up = async function(db) {
    // 🪓 LIMPIEZA DE EMERGENCIA: Forzar el borrado de tablas de prueba viejas o incompletas
    await db.query(`DROP TABLE IF EXISTS player_equipment CASCADE;`);
    await db.query(`DROP TABLE IF EXISTS item_definitions CASCADE;`);

    // 1. Crear catálogo maestro de ítems
    await db.query(`
        CREATE TABLE item_definitions (
            item_id SERIAL PRIMARY KEY,
            item_code VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            slot_type VARCHAR(20) NOT NULL,
            base_attack INT DEFAULT 0,
            base_defense INT DEFAULT 0
        );
    `);

    // 2. Crear tabla de inventario dinámico con la columna slot_type requerida
    await db.query(`
        CREATE TABLE player_equipment (
            id SERIAL PRIMARY KEY,
            player_id INT NOT NULL,
            item_definition_id INT NOT NULL REFERENCES item_definitions(item_id) ON DELETE CASCADE,
            slot_type VARCHAR(20) NOT NULL, -- Columna crítica restablecida
            is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
            acquired_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 3. Crear el índice único para cumplir con las reglas del Tower Gate
    await db.query(`
        CREATE UNIQUE INDEX idx_one_item_per_slot 
        ON player_equipment (player_id, slot_type) 
        WHERE (is_equipped = TRUE);
    `);

    // 4. Inyectar ítems de prueba idempotentes para el catálogo
    await db.query(`
        INSERT INTO item_definitions (item_code, name, slot_type, base_attack, base_defense) VALUES
        ('START_SWORD', 'Training Wooden Sword', 'Weapon', 10, 0),
        ('START_ARMOR', 'Evo One Vanguard Chestplate', 'Armor', 0, 15)
        ON CONFLICT (item_code) DO UPDATE 
        SET name = EXCLUDED.name, base_attack = EXCLUDED.base_attack, base_defense = EXCLUDED.base_defense;
    `);
};

exports.down = async function(db) {
    await db.query(`DROP TABLE IF EXISTS player_equipment;`);
    await db.query(`DROP TABLE IF EXISTS item_definitions;`);
};
