# ⚙️ 01_BACKEND_API_ROUTES.md | Especificación de Rutas Express API

Este documento contiene el plano de arquitectura de red para el servidor Node.js/Express. Define cómo se comunican las interfaces de los jugadores con la base de datos central en PostgreSQL (`orden_del_magen`).

---

## 🏰 1. Rutas de Infraestructura y Gestión de Tierras (`/api/buildings`)

### `POST /api/buildings/upgrade`
* **Descripción:** Eleva el nivel de un edificio activo (minas, granjas) consumiendo un costo exponencial en la divisa correspondiente. Ejecuta automáticamente la política de deflación.
* **Reflejo en la Base de Datos:** Modifica la tabla `properties` / `land_plots`.
* **Reglas de Negocio Incorporadas:**
  * Valida que el balance disponible del jugador cubra el costo.
  * Ejecuta la **Tasa de Quema Deflacionaria**: El **15%** del costo gastado se destruye permanentemente enviándose a una billetera de quema pública (`0x000...dead`).
  * El **85%** restante se recicla transfiriéndose al inventario de la tesorería o bóveda central del juego (*Game Vault*).

### `POST /api/buildings/harvest`
* **Descripción:** Vacía el búfer de recursos acumulados de forma pasiva por la tierra y los transfiere al balance líquido del jugador.
* **Reglas de Negocio Incorporadas:**
  * Evalúa el tiempo transcurrido desde la última recolección utilizando marcas de tiempo del servidor.
  * Valida la **Capacidad Máxima de Almacenamiento (Storage Cap)** (Ej. límite de 4 a 24 horas según el nivel del edificio). Los recursos generados más allá de este límite se descartan por completo hasta que el jugador realice la acción manualmente.

---

## ⚔️ 2. Rutas de Combate y Asignación de Botines (`/api/battle`)

### `POST /api/battle/arena-action`
* **Descripción:** Ejecuta una simulación matemática de combate basada en texto en el backend, consumiendo el puntaje de energía del héroe del jugador.
* **Parámetros del Payload:** `{ "player_id": Integer, "arena_id": Integer }`
* **Reglas de Negocio Incorporadas:**
  * Verifica si el jugador tiene suficiente energía en su reserva actual.
  * Calcula de manera instantánea el resultado evaluando Ataque vs. Defensa.
  * Si el jugador es victorioso, ejecuta el algoritmo de **Pesos Acumulados (Weighted Random)** para seleccionar un objeto de la tabla master (`item_definitions`).
  * Registra de manera inmediata el artículo dentro de la tabla de inventario dinámico (`player_equipment`) con el flag `is_equipped = false`.

---

## ☕ 3. Rutas de Reclamación y Tienda de Café Real (`/api/store`)

### `GET /api/store/coffee-gifts`
* **Descripción:** Devuelve el catálogo completo de productos físicos e inventario disponible administrados bajo la marca **Cafe de la Doncella LLC**.
* **Origen de Datos:** Realiza una consulta directa (`SELECT`) sobre la tabla de sistema público `caffe_gifts`.

### `POST /api/store/redeem-gift`
* **Description:** Permite canjear recompensas por café físico.
* **Seguridad:** El `player_id` se deriva estrictamente del contexto autenticado del servidor (`req.user.id`). Se rechazan payloads que incluyan IDs de cuenta en el cuerpo de la petición.
* **Fulfillment:** Registers a row in the social tracking layer with execution parameters pending token burn approvals.

* **Parámetros del Payload:** `{ "player_id": Integer, "gift_id": Integer, "shipping_address": String }`
* **Reglas de Negocio Incorporadas:**
  * Deduce de manera directa el costo fijado en la moneda prémium **\$DONCELLA** de la cuenta del usuario.
  * Reduce en `-1` el campo `stock_available` de la tabla `caffe_gifts`.
  * Inserta una nueva fila de control dentro de la tabla de logística `player_gift_redemptions` con el estado inicializado como `'Pending'` para habilitar la orden de envío de café físico.

---

## 🛡️ 4. Rutas de Sincronización e Identidad de Red (`/api/auth`)

### `POST /api/auth/polygon-sync`
* **Descripción:** Enlaza la cuenta de usuario con una dirección de billetera criptográfica verificada de la red Polygon.
* **Reglas de Negocio Incorporadas:**
  * Ejecuta una consulta JSON-RPC para verificar la titularidad de los identificadores únicos de activos (Tokens/NFTs) en la cadena de bloques.
  * Actualiza la dirección pública del remitente dentro de tu esquema local, permitiendo sincronizar la titularidad de la tierra digital en el backend.