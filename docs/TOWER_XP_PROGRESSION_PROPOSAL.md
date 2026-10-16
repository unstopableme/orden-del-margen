# Propuesta: progresion de Kingdom Tower y Character XP

**Estado:** propuesta para decision; no aprobada ni implementada
**Alcance:** niveles Tower N1-N3 y otorgamiento de Character XP. No cambia la
identidad comunitaria, puntos, niveles, tablas, endpoints ni comportamiento de
runtime.

## 1. Gate confirmado de N3 (requisito; no propuesta)

- **Character XP:** al menos **4.500 XP de por vida** en la cuenta de Tower.
  Solo cuentan premios verificables de Training Grounds, Arena Stage Victories,
  Bounty Board tasks e Idle Expeditions/Adventures completadas. Construction/
  building XP y puntos comunitarios no cuentan.
- **Equipo:** Tier I o superior realmente equipado en cada uno de los seis slots
  del avatar principal: Weapon, Armor, Helmet, Boots, Ring y Amulet. Tener los
  objetos en inventario no satisface el requisito.
- **No consumo:** XP y equipo son requisitos de estado; no se gastan, reservan,
  queman, reinician ni consumen al completar una mejora.
- **Atomicidad:** si falla cualquier prerequisito, nivel y balances permanecen
  sin cambios. Solo pueden debitarse `$DONCELLA` y materiales de un coste
  aprobado.
- El gate N3 no aprueba un coste, un requisito de N1/N2, una fecha de
  implementacion de Adventures ni la implementacion de Tower.
- Tower/Character XP permanecen separados de puntos, niveles, badges,
  referrals y knowledge scores comunitarios.

Estas reglas coinciden con [DECISIONS.md](./DECISIONS.md),
[ECONOMY.md](./ECONOMY.md) y
[TOWER_LEVEL_3_ELIGIBILITY_CHECKER.md](./TOWER_LEVEL_3_ELIGIBILITY_CHECKER.md).
La elegibilidad de distribucion semanal sigue su propio checker de N3 y no es
un premio garantizado.

## 2. Decisiones abiertas y recomendacion

Solo el gate indicado en la seccion 1 esta confirmado. Todos los valores,
costes y requisitos de progresion que siguen son candidatos, no reglas
aprobadas ni autorizacion para cargos, premios, migraciones o cambios en el
runtime.

| Decision pendiente | Recomendacion concreta | Motivo y limite |
| --- | --- | --- |
| Nivel inicial | Crear cada Tower de cuenta en **N1**. N1 no cuesta `$DONCELLA`, materiales ni Character XP. No otorgar XP automaticamente al crear la cuenta. | Hace explicito el estado base y evita una deuda o un saldo inicial implicito. Una migracion de cuentas existentes requeriria una politica de backfill aprobada por separado. |
| N1→N2 | Candidato: **1.500 XP de por vida**, sin coste ni equipo requerido y sin consumir XP. | Un hito intermedio; debe probarse contra la cadencia de juego antes de aprobarlo. |
| Requisitos N2→N3 | **Confirmado:** el gate de N3 de la seccion 1. **Pendiente:** si se agregaran otros requisitos; esta propuesta recomienda no agregar edificios ni contadores paralelos. | El gate XP+equipo no se debe confundir con costes o con una decision de implementacion. |
| Coste N2→N3 | Candidato: **1.500 `$DONCELLA`**, **300** de cada uno de `wood`, `stone` y `wheat`, y **150** de cada uno de `food` y `cloth`. Excluir `embers`. | Reutiliza cantidades anteriores como punto de partida; normaliza `bronze` a `$DONCELLA` y no inventa un activo para `embers`. No aprobar el coste hasta que exista una ruta alcanzable para obtener moneda y equipo Tier I en los seis slots. |
| Nivel inicial/backfill | N1 gratuito para cuentas nuevas; definir una politica separada para cuentas preexistentes. | Evita crear balances o niveles de Tower implicitos. |
| Otorgamiento de XP | Registrar solo despues de que un servicio del juego confirme el evento finalizado; una unica concesion por cuenta/evento. | El cliente no elige cantidad, fuente ni resultado; los reintentos no duplican XP. |

### Importes candidatos de XP (no aprobados)

Como punto de partida de balance, se recomienda probar estos premios fijos:

| Fuente permitida | XP candidato por evento | Regla de elegibilidad recomendada |
| --- | ---: | --- |
| Training Grounds | 25 | Sesion completada y validada por el servicio; maximo cuatro premios por cuenta y dia UTC. |
| Arena Stage Victory | 50 | Victoria final confirmada por el servicio de Arena; una concesion por identificador unico de victoria. |
| Bounty Board task | 100 | Tarea completada y reclamada tras validar sus objetivos; una concesion por tarea completada. |
| Idle Expedition/Adventure | 150 | Solo al estado terminal `completed`; una concesion por expedicion completada. No otorgar por iniciar, reclamar una plaza o cancelar. |

Estos importes no son proporcionales a la dificultad y necesitan simulacion y
aprobacion de balance antes de adoptarse. La elegibilidad de Adventures como
fuente no fija su fecha de implementacion. Si una actividad no esta disponible
o no puede producir evidencia verificable, no concede XP.

## 3. Acceso a `$DONCELLA` y equipo antes de exigir el gate

La regla economica vigente identifica `$DONCELLA` como utilidad que se ganaria
por tareas, batallas y comercio; **no fija cantidades ni confirma que esas
fuentes ya esten implementadas**. El equipo Tier I aparece en catalogos,
tablas de loot y recetas como contenido candidato, no como objetos o rutas
disponibles. La receta ilustrativa de arma no cubre Armor, Helmet, Boots, Ring
ni Amulet. Por ello no se debe activar un coste N2→N3 ni exigir los seis slots
hasta que un jugador pueda obtener de forma verificable todo lo requerido.

Recomendacion para cerrar esa dependencia, antes de habilitar Tower upgrades:

1. Aprobar al menos una fuente repetible de `$DONCELLA` basada en actividad de
   juego completada (recomiendo primero una tarea Bounty Board y/o una victoria
   Arena), con monto, limites, ledger, fuente y regla anti-replay definidos.
   El comercio puede complementar el acceso, pero no debe ser el unico camino
   porque requiere contraparte y oferta.
2. Aprobar un camino determinista y de bajo nivel para una pieza Tier I de cada
   slot. Preferencia: recompensa de onboarding/objetivos iniciales o recetas
   de crafting garantizadas con insumos obtenibles antes del gate. El botin
   aleatorio puede ser una ruta adicional, no la unica garantia para seis
   slots.
3. Implementar y validar inventario, equipamiento por slot, propiedad,
   restricciones de avatar y ledger de adquisicion. El checker debe consultar
   estado equipado autoritativo, no una seleccion enviada por el cliente.
4. Publicar en la UI los requisitos exactos y progreso, junto con al menos una
   ruta valida para ganar `$DONCELLA` y cada slot. Si alguna ruta se pausa, no
   se debe bloquear con coste o gear a quienes aun no pueden obtenerlos.

Una alternativa de acceso garantizado es un conjunto inicial completo Tier I,
pero requiere decision explicita sobre si es una recompensa gratis y sobre su
efecto en la economia. No se asume aqui ningun bono de `$DONCELLA`, conversion
de puntos comunitarios ni equipamiento automatico. El acceso y su balance son
decisiones distintas de la elegibilidad N3 ya confirmada.

## 4. Contrato propuesto para XP verificable

### Autoridad y evidencia

- La cantidad de XP y el tipo de fuente los determina una regla versionada del
  servidor; nunca se aceptan del body como autoridad.
- El servicio que conoce el resultado final de cada actividad emite el evento
  de finalizacion y el premio dentro de una transaccion o mediante un outbox
  transaccional equivalente.
- Cada premio referencia `account_id`, `source_type`, identificador inmutable
  del evento fuente, cantidad, instante efectivo, version de regla y evidencia
  reproducible del resultado. El identificador del evento no debe contener
  tokens, credenciales ni datos innecesarios.
- La clave unica recomendada es
  `(account_id, source_type, source_event_id)`. Un replay con el mismo payload
  devuelve el resultado original sin sumar XP otra vez; la misma clave con
  distinto tipo, cantidad o fingerprint se rechaza como conflicto.
- La evidencia de una victoria, tarea o sesion debe provenir del servicio de
  esa actividad, no de una declaracion del cliente. La concesion es append-only;
  una correccion autorizada se registra como evento compensatorio auditado, no
  reescribiendo el premio original.
- El total de por vida se deriva del ledger de premios o se mantiene como
  proyeccion transaccional conciliable con ese ledger. Las dos representaciones
  nunca deben divergir silenciosamente.
- Solo los cuatro `source_type` permitidos pueden contribuir al total
  elegible. Construccion, edificios idle y puntos comunitarios son fuentes
  distintas y se excluyen por esquema y validacion, no solo por UI.

### Fronteras con otras progresiones

- Character XP pertenece a la cuenta de juego y Tower del jugador; no se agrega
  al perfil comunitario ni se presenta como puntos.
- Puntos comunitarios no pueden convertirse, mapearse ni migrarse a Character
  XP. Las acciones comunitarias no son fuentes validas de Tower XP.
- Un premio de XP no es `$DONCELLA`, un material, un punto comunitario ni una
  asignacion `$MARGEN`.
- Las tablas candidatas `kingdom_towers` y `character_xp_events` descritas en
  [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) son solamente referencias
  de diseño; esta propuesta no las crea ni autoriza.

## 5. Propuesta completa: Training Grounds con Character XP

Esta es la propuesta para el primer incremento de XP, no una autorizacion de
implementacion. Training Grounds es una fuente permitida de Character XP, pero
las reglas de sesion y cantidades de esta seccion son recomendaciones nuevas
pendientes de aprobacion.

### Experiencia del jugador y criterio de exito

1. El jugador autenticado pulsa **Iniciar entrenamiento**. El servidor crea
   una sesion asociada a la cuenta autenticada y devuelve cinco desafios
   secuenciales. El cliente no elige la cuenta, XP, respuestas correctas ni
   resultado.
2. Cada desafio presenta una situacion breve de entrenamiento tactico y un
   conjunto de acciones posibles. El jugador elige y envia una accion para
   cada desafio. Las reglas versionadas del servidor determinan la respuesta
   correcta; el cliente solo presenta el desafio y la respuesta recibida.
3. Los desafios abren en los offsets del servidor `t=0`, `t=2`, `t=4`, `t=6`
   y `t=8` minutos desde `started_at`. Sus ventanas son intervalos
   semiabiertos: `[0,2)`, `[2,4)`, `[4,6)`, `[6,8)` y `[8,10)` minutos.
   Solo se acepta una respuesta dentro de la ventana correspondiente; el
   instante de cierre ya es tardio. El jugador puede revisar la respuesta
   despues de que el servidor la registre, pero no responder antes de la
   apertura ni reemplazar una respuesta aceptada.
4. La sesion es **exitosa** si quedan cerrados los cinco desafios y hay al
   menos cuatro aciertos. Cada desafio cerrado queda como `CORRECT`,
   `INCORRECT` o `MISSED`; tardanza/ausencia equivale a `MISSED` y cuenta como
   incorrecta. No hay premio parcial.
5. El deadline absoluto es `started_at + 10 minutos`. El servidor compara la
   recepcion con su reloj de base de datos en UTC. Una respuesta recibida
   exactamente en el borde de cierre es tardia; se rechaza para puntuacion y
   queda como desafio sin respuesta. Despues de cerrar la ultima ventana, la
   sesion queda terminal: `COMPLETED_SUCCESS` si hay al menos cuatro aciertos;
   con menos, `EXPIRED` si no hubo respuestas aceptadas y
   `COMPLETED_FAILURE` si hubo al menos una. Si el sistema no materializa el
   estado en ese instante, la siguiente lectura o escritura lo materializa
   usando esos timestamps persistidos, no la hora del navegador.

### Decisiones de producto y recomendacion

| Decision pendiente | Recomendacion | Razon |
| --- | --- | --- |
| Duracion y ventanas | Aperturas en `t=0/2/4/6/8`; ventanas `[0,2)`, `[2,4)`, `[4,6)`, `[6,8)`, `[8,10)` minutos; deadline duro en `t=10`. | Intervalos semiabiertos evitan aceptar una respuesta simultaneamente como tardia para un desafio y valida para el siguiente. |
| Regla de exito | Los cinco desafios deben cerrar como `CORRECT`, `INCORRECT` o `MISSED`; otorgar solo con al menos cuatro `CORRECT`. | Umbral facil de comunicar. Cada desafio sin respuesta valida al cierre cuenta como incorrecto, pero una unica omision no impide ganar si los otros cuatro son correctos. |
| XP | **25 Character XP** por sesion exitosa, fija y definida por una version de reglas. | Recompensa inicial pequena; no escala con puntuacion, rapidez, reintentos ni valores enviados por el cliente. |
| Repeticiones con premio | Maximo **4 sesiones exitosas premiadas por cuenta y fecha UTC de inicio** (100 XP por fecha de inicio). Reservar una plaza de premio al crear cada sesion; liberar la reserva si falla, expira o se anula tecnicamente. | La reserva evita que sesiones de dias distintos que terminan juntas sobrepasen la cuota del dia al que pertenecen. |
| Inicios | Maximo **6 sesiones iniciadas por cuenta y dia UTC**, incluida la sesion activa; una sola sesion activa por cuenta. Rechazar nuevos inicios si ya se otorgaron cuatro premios ese dia. | Contiene spam de inicios y permite dos sesiones fallidas adicionales; una sesion activa unica evita exceder la cuota en carreras de finalizacion. |
| Sesion fallida/expirada | No da XP; conserva el consumo de una plaza de inicio, pero libera la plaza de premio. | Reduce la ventaja de abandonar y reintentar sin bloquear una recompensa diaria por un fallo ordinario. `VOID` validado como fallo tecnico libera ambas plazas. |
| Reintentos de transporte | Permitir reintentar la misma operacion idempotente; nunca crear otro premio. No reiniciar desafios ya evaluados. | Recupera respuestas perdidas sin habilitar repeticiones de contenido para farmear XP. |

Los numeros y el formato de desafio son candidatos de balance. Antes de
adoptarlos se recomienda probar la tasa de exito, accesibilidad, duracion real
y carga operativa; cualquier cambio se publica como una nueva version de regla
y no reescribe sesiones ya finalizadas.

### Ejemplos ilustrativos de los cinco desafios

Estos ejemplos describen el formato y la evaluacion server-side; no son aun
contenido canonico. En una sesion real el cliente recibe el texto, opciones e
identificador del desafio, pero nunca `correctAction` ni la explicacion de
correccion antes de enviar su accion.

| N. | Situacion que ve el jugador | Acciones presentadas | `correctAction` server-side y criterio |
| ---: | --- | --- | --- |
| 1 | Un aliado esta bajo ataque y el jugador conserva una accion defensiva. | `A`: cubrir al aliado; `B`: ignorarlo y atacar un objetivo distante; `C`: abandonar el encuentro. | `A`. Coincide con la regla versionada `protect_exposed_ally`; `B` y `C` no la satisfacen. |
| 2 | Un enemigo anuncia una carga y el jugador puede interrumpirla o preparar un ataque. | `A`: interrumpir antes de la carga; `B`: esperar a recibir el impacto; `C`: cambiar equipo desde el inventario durante la resolucion. | `A`. La accion debe ser `interrupt` y quedar recibida antes de que el servidor cierre la ventana. |
| 3 | Un compañero necesita curacion y un objetivo hostil esta marcado. | `A`: usar la habilidad de apoyo disponible; `B`: repetir un ataque sin atender al estado; `C`: solicitar una recompensa. | `A`. El estado simulado y la politica de prioridad de apoyo estan fijados en los datos del desafio. |
| 4 | El grupo encuentra una trampa visible antes de avanzar. | `A`: inspeccionar y desactivar; `B`: avanzar sin inspeccion; `C`: reclamar XP antes de resolverla. | `A`. El servidor comprueba el codigo de accion contra `inspect_then_disarm`; no evalua texto libre. |
| 5 | Tras cumplir el objetivo, queda una salida segura y una ruta opcional de riesgo. | `A`: asegurar el objetivo y extraer; `B`: reiniciar el entrenamiento; `C`: afirmar que se completo sin seleccionar salida. | `A`. El servidor verifica `secure_objective_and_extract` en el estado de simulacion. |

Por ejemplo, si se reciben `A, A, B, A, A` dentro de sus ventanas, el servidor
compara los cinco codigos con la clave privada `[A,A,A,A,A]`, registra cuatro
aciertos y termina `COMPLETED_SUCCESS`. Con `A, A, B, B, A` hay solo tres
aciertos y termina `COMPLETED_FAILURE`. Esos vectores explican el umbral 4/5;
las letras y escenarios no son una clave global: cada desafio real tiene un
`challenge_id`, orden y clave propios bajo la version fijada para esa sesion.

### Ciclo de vida y operaciones de sesion

Estados recomendados:

```text
ACTIVE -> COMPLETED_SUCCESS
       -> COMPLETED_FAILURE
       -> EXPIRED
       -> VOID
```

`COMPLETED_FAILURE` significa que hubo al menos una respuesta aceptada, pero
el resultado final fue inferior a cuatro aciertos. `EXPIRED` significa que la
sesion llego a `t=10` sin ninguna respuesta aceptada. Ambos estados dan cero
XP, conservan la plaza de inicio y liberan la plaza de premio.

- **Crear:** `POST /api/gameplay/training-sessions` (ruta ilustrativa, no
  aprobada). Requiere autenticacion y `Idempotency-Key`. El servidor deriva
  `account_id`, congela `rules_version`, fija `started_at` y
  `quota_date=DATE(started_at AT TIME ZONE 'UTC')`, emite `session_id`
  aleatorio y crea desafios con respuestas esperadas no expuestas al cliente.
  Tambien reserva atomicamente una plaza de inicio y una plaza de premio para
  `quota_date`. La creacion y el primer desafio se persisten duraderamente
  antes de responder.
- **Limites de creacion:** una sesion activa por cuenta; bajo un lock/contador
  transaccional por `(account_id, quota_date)`, comprobar y reservar como
  maximo seis plazas de inicio y cuatro plazas de premio. La reserva de inicio
  cuenta inmediatamente contra seis. Una reserva de premio cuenta contra
  cuatro hasta convertirse en premio o liberarse. `COMPLETED_FAILURE` o
  `EXPIRED` conserva la plaza de inicio y libera la de premio; un `VOID`
  tecnico validado libera ambas. Si no quedan plazas del tipo requerido,
  rechazar el inicio. La fecha y ambas reservas pertenecen siempre al dia UTC
  de `started_at`, incluso si la sesion cruza medianoche: no se transfieren ni
  vuelven a reservar en el dia siguiente. Por ejemplo, una sesion iniciada a
  las 23:58 UTC retiene ambas reservas en el bucket de ese dia hasta su
  resultado; una iniciada a las 00:01 UTC usa el bucket nuevo. Un request
  repetido con la misma clave y payload devuelve la sesion original sin
  volver a contarla. La misma clave con payload distinto devuelve conflicto.
  Una clave nueva no crea una segunda sesion activa.
- **Responder:** `POST /api/gameplay/training-sessions/:sessionId/answers`
  (ilustrativo). Cada mensaje lleva `challenge_id`, accion elegida y clave
  idempotente o numero de secuencia. El servicio comprueba propietario,
  estado, desafio actualmente habilitado, que
  `open_at <= received_at < close_at`, version de reglas y que no exista
  respuesta previa. El `received_at` es asignado por el servidor/DB. Persiste
  la accion normalizada y el resultado calculado en servidor. Primero busca
  la clave idempotente: si ya se acepto el mismo envio, devuelve el resultado
  guardado aunque la ventana o sesion hayan cerrado; si la misma clave trae
  payload distinto, devuelve conflicto. Solo una clave nueva pasa las
  validaciones de estado y ventana y puede crear una respuesta.
- **Finalizar:** cada desafio se cierra al aceptarse una respuesta o al vencer
  su ventana. Una vez cerrados los cinco, una transaccion vuelve a calcular el
  score desde estados persistidos. Con al menos cuatro `CORRECT`, marca
  `COMPLETED_SUCCESS` y convierte la plaza de premio reservada en consumida.
  Con una o mas respuestas aceptadas y menos de cuatro aciertos, marca
  `COMPLETED_FAILURE` y libera la plaza de premio. No existe endpoint que
  acepte `success=true`, `xp`, score final o respuestas correctas del cliente.
- **Tardia o ausente:** si una respuesta llega en `close_at` o despues,
  devolver `ANSWER_WINDOW_CLOSED`, no guardar su accion y cerrar el desafio
  como `MISSED` si aun no tiene respuesta. No se permite que la respuesta
  tardia se convierta en respuesta del siguiente desafio. Una ausencia se
  marca `MISSED` al cerrar la ventana, no se espera hasta recibir una
  solicitud del cliente. Cuatro respuestas correctas y una omision pueden
  aprobar; cualquier otro resultado con menos de cuatro aciertos falla. Un
  replay identico de una respuesta aceptada devuelve su resultado original
  aunque la ventana ya haya cerrado.
- **Vencimiento:** en `t=10`, cerrar la quinta ventana y todos los estados
  pendientes. Si no hubo ninguna respuesta aceptada, marcar `EXPIRED`; si
  hubo alguna, marcar `COMPLETED_FAILURE` cuando el total sea menor de cuatro
  aciertos. Si hay cuatro o cinco aciertos, marcar `COMPLETED_SUCCESS`.
  Solicitudes posteriores no pueden cambiar el estado ni otorgar XP.
- **Void tecnico:** `VOID` solo se permite antes de un resultado final y ante
  un fallo interno verificable que invalida la sesion completa, no porque el
  jugador responda mal, abandone, se desconecte o alegue un problema. Codigos
  cerrados recomendados: `RULESET_INTEGRITY` (fingerprint/reglas no validos),
  `CHALLENGE_DATA_UNAVAILABLE` (el servicio no pudo servir el desafio y hay
  evidencia del error en logs; la falta de request del jugador no basta) y
  `SERVER_ABORTED_SESSION` (fallo interno confirmado que hace imposible
  reproducir o completar la evaluacion). Guardar `void_code`, `voided_at`,
  version de servicio/ruleset y referencia correlacionada a logs sin datos
  sensibles. Solo un reconciliador server-side autorizado puede marcar VOID
  tras validar el codigo y la evidencia; una decision administrativa manual
  requiere motivo y auditoria. `VOID` libera inicio y premio de su
  `quota_date`. Errores transitorios reintentables no anulan la sesion
  automaticamente; se devuelve error y se permite reintentar la misma clave.
- **Lectura:** `GET /api/gameplay/training-sessions/:sessionId` devuelve al
  propietario estado, desafios/resultados visibles, deadline y resultado. No
  devuelve respuestas futuras, claves internas ni el total comunitario.

### Verificacion del exito y resistencia a manipulacion

- Las respuestas correctas se conservan solo en servidor. Se recomienda
  seleccionar los cinco desafios desde un catalogo/rule set versionado usando
  una fuente criptografica aleatoria por sesion y persistir la seleccion; la
  fuente aleatoria, respuestas esperadas y datos de puntuacion no se exponen
  antes de responder. Las reglas deben permitir reproducir la decision en
  auditoria.
- El servidor acepta solo una respuesta por desafio, solo durante su ventana de
  hasta 120 segundos y en orden. `challenge_id` pertenece a la sesion y no es
  reutilizable en otra.
- Cuenta, fechas de apertura y recepcion, intentos, resultado y version de
  regla los fija el servidor. No se confia en reloj, puntuacion, tiempo jugado
  ni resultado final del navegador.
- El servicio limita frecuencia por cuenta y aplica los limites diarios bajo
  concurrencia. Las actualizaciones de sesion, contador diario y ledger se
  serializan para que requests concurrentes no excedan las cuotas.
- Reusar cookies, ids de sesion o claves de idempotencia de otra cuenta falla
  por autorizacion; una clave de idempotencia no reemplaza autenticacion.
- El cliente puede mostrar animacion o feedback, pero solo el estado guardado
  por el servidor acredita exito y XP.

### Ledger de XP y total de por vida

La concesion recomendada ocurre en la misma transaccion que marca el resultado
final:

1. Bloquear la fila de sesion y volver a validar que esta `ACTIVE`, que las
   cinco ventanas estan cerradas y cada desafio tiene estado `CORRECT`,
   `INCORRECT` o `MISSED`.
2. Calcular en servidor si cumple el criterio 4/5. Confirmar que el bucket UTC
   asociado al inicio tiene cuota disponible; los inicios serializados y el
   rechazo tras el cuarto premio impiden sobreasignar premios.
3. Marcar resultado terminal. Para exito, insertar exactamente un evento
   `source_type=training_grounds`, `source_event_id=session_id`, `xp=25`,
   `account_id`, `occurred_at`, `quota_date` UTC de `started_at`,
   `rules_version`/fingerprint y una referencia de auditoria sanitizada. La
   unicidad `(account_id, source_type, source_event_id)` impide premios
   duplicados.
4. Actualizar una proyeccion de Character XP de por vida en la misma
   transaccion, o calcular el total desde el ledger. Si se mantiene la
   proyeccion, verificar periodicamente que coincide con la suma autoritativa.
5. Commit de estado final, premio y reservas/contador diario en una sola transaccion. Si
   algo falla, no debe quedar una sesion exitosa sin premio ni un premio sin
   resultado exitoso.

El ledger es append-only. Una repeticion de finalizacion para el mismo
`session_id` devuelve el resultado persistido y XP acreditado originalmente;
no inserta otro evento ni vuelve a incrementar el total. Si la unicidad detecta
el mismo evento con cantidad o fingerprint diferente, se trata como conflicto
de integridad, se hace rollback y se alerta. Correcciones excepcionales se
representan con eventos compensatorios auditados, no editando ni borrando la
concesion original.

Consulta de Character XP propuesta:

- `GET /api/gameplay/character-xp` deriva la cuenta de la sesion autenticada y
  devuelve `lifetimeTotal`, `asOf` y, opcionalmente, eventos paginados
  (`sourceType`, `xp`, `occurredAt`, referencia legible). No acepta un
  `account_id` del cliente.
- El total es un entero no negativo derivado de todos los eventos validos de
  Character XP de esa cuenta, incluidos unicamente tipos de fuente permitidos
  y compensaciones aprobadas. No incluye community points, XP de construccion
  ni saldos de `$DONCELLA`.
- Este primer incremento recibe XP solo de Training Grounds. Arena, Bounty
  Board y Expeditions no pueden insertar eventos hasta integrar cada fuente
  con su propia prueba de finalizacion, regla versionada e idempotencia.
- La respuesta no calcula Tower level, elegibilidad N3, payout ni recompensa
  semanal. UI y API etiquetan el dato `Character XP`, nunca `community points`.

### Limite explicito del primer incremento

El primer incremento contiene un ciclo verificable de Training Grounds y la
lectura del total lifetime de Character XP, sujeto a aprobacion de reglas,
actividad y almacenamiento. No crea ni modifica Tower level, no evalua N1/N2/N3,
no debita `$DONCELLA` o materiales, no exige ni equipa gear y no cambia
elegibilidad de reward/payout. Si Training Grounds aun no tiene un servicio
autoritativo capaz de verificar cada respuesta, primero se debe construir y
aprobar ese contrato de actividad; no se concede XP desde un endpoint que
acepte una declaracion del cliente.

## 6. Flujo propuesto para mejorar Tower (posterior; no incluido en primer incremento)

1. El servicio obtiene la cuenta autenticada y carga Tower, XP, equipo y saldos
   desde estado autoritativo.
2. Valida el nivel esperado y todos los prerequisitos para la transicion
   solicitada. Para N3, valida 4.500 XP y los seis slots Tier I+ equipados.
3. Si falla una validacion, rechaza la operacion sin cambiar Tower, Character
   XP, equipo ni balances.
4. Si todos los prerequisitos pasan, debita solamente los costes aprobados,
   escribe sus movimientos de ledger y marca el nuevo nivel en la misma
   transaccion. El XP total y el inventario/equipo permanecen intactos.
5. Guarda la solicitud y su resultado con clave idempotente; un replay devuelve
   el resultado comprometido y no vuelve a debitar.

Los pasos son requisitos de diseno, no una autorizacion para crear servicio,
schema, ruta o migracion.

## 7. Decisiones solicitadas antes de implementar

1. Confirmar nivel inicial N1 y la politica de backfill.
2. Aprobar o reemplazar el umbral N1→N2 de 1.500 XP y confirmar que esa
   transicion no cobra ni consume XP.
3. Confirmar que N2→N3 usa unicamente el gate N3 confirmado, sujeto a los
   recursos de acceso previos de la seccion 3.
4. Aprobar, modificar o rechazar por separado el coste candidato N2→N3. No
   activar cobros hasta que `$DONCELLA` y los seis slots Tier I sean alcanzables.
5. Aprobar los montos/cap de las cuatro fuentes XP o decidir sus montos por
   separado; el primer incremento propuesto solo usa Training Grounds.
6. Aprobar las reglas de terminacion, limite diario, replay y correcciones de
   premios XP.
7. Autorizar por separado el diseno tecnico y sus pruebas. No habilitar Tower
   upgrades, elegibilidad ni debitos de runtime basandose solo en esta propuesta.
