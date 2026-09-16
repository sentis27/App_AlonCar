# Análisis de Costos y Valoración — App_AlonCar

## ¿Puede este sistema costar más de US$10.000?

### Respuesta corta: **Sí. Fácilmente. Y probablemente valga entre US$18.000 y US$35.000.**

Según datos de mercado actualizados (septiembre 2026):
- Un ERP custom básico (1-3 módulos): **US$25.000 - US$80.000**
- Un ERP custom medio (4-6 módulos): **US$80.000 - US$250.000**
- Tu sistema tiene **7 módulos** (6 operativos + BI/Analytics)

Pero esos son precios de empresas de software con equipos completos. Tu caso es diferente: sos una sola persona usando IA como multiplicador. Eso baja los costos de producción, pero **no baja el valor del producto**. Un auto fabricado por un artesano no vale menos que uno de fábrica — puede valer más.

---

## 1. Inversión ya realizada

| Concepto | Cantidad | Valor hora (mercado semi-senior) | Total |
|---|---|---|---|
| Horas-hombre tuyas | 90 horas | US$20 - US$30/hora | **US$1.800 - US$2.700** |
| Costos de IA (suscripciones + APIs) | — | — | **US$80** |
| **Total invertido** | | | **US$1.880 - US$2.780** |

> [!NOTE]
> Usé US$20-30/hora como referencia de mercado para un desarrollador semi-senior freelance en Argentina/Uruguay. Un developer senior cobra US$30-60/hora. Una consultora externa cobraría US$50-80/hora.

---

## 2. Estimación de lo que falta

### 2a. Horas-hombre restantes

| Fase / Tarea | Horas estimadas |
|---|---|
| Diseño de esquema de base de datos (todas las tablas, relaciones) | 15 - 25 h |
| Backend / lógica de negocio para los 6 módulos | 40 - 60 h |
| Workflows de n8n (automatizaciones, alertas, conciliaciones) | 20 - 30 h |
| Frontend / Interfaces de usuario | 80 - 120 h |
| Integración Google Sheets ↔ n8n ↔ Supabase (afinamiento) | 10 - 15 h |
| Testing, debugging, ajustes | 20 - 30 h |
| Deployment, configuración servidor, dominio | 8 - 12 h |
| Documentación de usuario y manual de procedimientos | 10 - 15 h |
| **Total estimado restante** | **203 - 307 h** |

> [!IMPORTANT]
> Redondeando: **~200-300 horas más de tu trabajo.** Considerando que usás IA como asistente de desarrollo, esto podría acortarse un 20-30%, pero es mejor presupuestar conservador.

### 2b. Costos de IA restantes para desarrollo

| Concepto | Costo mensual | Meses estimados (si dedicás ~15-20h/semana) | Total |
|---|---|---|---|
| Claude Pro (plan actual) | US$20/mes | 4 - 6 meses | US$80 - US$120 |
| Antigravity | US$6/mes | 4 - 6 meses | US$24 - US$36 |
| APIs adicionales (si necesitás llamadas extra) | ~US$5-10/mes | 4 - 6 meses | US$20 - US$60 |
| **Total IA restante** | | | **US$124 - US$216** |

### 2c. Resumen: Costo total del desarrollo completo

| Concepto | Mínimo | Máximo |
|---|---|---|
| HH ya invertidas (90h × US$20-30) | US$1.800 | US$2.700 |
| HH restantes (~250h × US$20-30) | US$5.000 | US$7.500 |
| IA ya gastada | US$80 | US$80 |
| IA restante estimada | US$124 | US$216 |
| **TOTAL costo de producción** | **US$7.004** | **US$10.496** |

Esto es lo que te cuesta **a vos producirlo**. No es lo que vale.

---

## 3. ¿Cuánto VALE el sistema? (Precio de mercado)

Para determinar el valor real, hay que considerar:

### Factor 1: Costo de desarrollo a tarifa de mercado
Si el astillero contratara una consultora o desarrollador externo:

| Concepto | Cálculo | Total |
|---|---|---|
| Horas totales del proyecto (~340-400h) | × US$40-60/hora (tarifa consultora) | **US$13.600 - US$24.000** |
| Relevamiento y aprendizaje del negocio (un externo necesita 2-4 meses extra) | 160-320h × US$40/hora | **US$6.400 - US$12.800** |
| **Total si lo hiciera un externo** | | **US$20.000 - US$36.800** |

### Factor 2: Tu conocimiento de dominio (ventaja que no tiene precio fijo)
Este es tu argumento más fuerte en la presentación:

- ✅ Vos **creaste** las planillas actuales — conocés cada campo, cada fórmula, cada conexión.
- ✅ Sos **el único** que entiende el flujo completo de información del astillero.
- ✅ Un externo necesitaría **meses de aprendizaje** antes siquiera de empezar a programar.
- ✅ Ese conocimiento de dominio tiene un valor estimado de **US$5.000 - US$12.000** en horas de consultoría.

### Valoración final del sistema

| Método de valoración | Rango estimado |
|---|---|
| Por costo de producción propio (lo que te costó a vos) | US$7.000 - US$10.500 |
| Por costo de reemplazo (lo que costaría contratar a otro) | US$20.000 - US$36.800 |
| **Valor justo de mercado (punto medio razonable)** | **US$12.000 - US$20.000** |

> [!TIP]
> **Para la presentación:** No digas "esto vale US$20.000". Decí: _"Un desarrollo de esta complejidad en el mercado cuesta entre US$20.000 y US$35.000. Yo puedo entregarlo por una fracción de eso gracias a que ya conozco el negocio y uso IA como herramienta de desarrollo."_

---

## 4. Costos operativos mensuales (una vez en producción)

| Servicio | Plan | Costo mensual |
|---|---|---|
| Hostinger VPS KVM 1 (servidor para n8n + app) | Plan básico promocional | ~US$5 - US$10 |
| Supabase (base de datos) | Free tier (para empezar) / Pro si crece | US$0 - US$25 |
| Dominio | .com o .com.ar | ~US$1 (prorrateado) |
| Claude / IA (si el sistema usa IA en producción) | Según consumo | ~US$0 - US$10 |
| **Total operativo mensual** | | **~US$6 - US$46** |

> [!NOTE]
> Para empezar, con Supabase Free y Hostinger básico, los costos son muy bajos (~US$6-10/mes). Si el sistema crece y necesita Supabase Pro, sube a ~US$35-46/mes.

---

## 5. Modelo de negocio: Suscripción vs. Venta

### Opción A: Suscripción mensual (tu preferencia)

| Concepto | Valor |
|---|---|
| Costo operativo mensual (hosting, IA, etc.) | ~US$10 - US$50 |
| Tu margen de ganancia neto deseado | US$100 - US$150 |
| **Cuota mensual al astillero** | **~US$150 - US$200** |

**Ventajas para vos:**
- Ingreso recurrente mensual.
- Sos dueño del sistema, lo podés escalar o vender a otros astilleros en el futuro.
- Si el sistema crece (sueldos, vacaciones, cuentas corrientes), justificás aumentar la cuota.

**Ventajas para el astillero:**
- Sin inversión inicial fuerte.
- Incluye soporte, mantenimiento y actualizaciones.
- Costo predecible y cancelable.

**Análisis financiero:**
- A US$150/mes, en 12 meses el astillero habrá pagado US$1.800.
- En 5 años: US$9.000.
- Ellos nunca pagan el valor real del sistema (US$12-20k), pero tienen servicio continuo.
- Vos recuperás tu inversión en ~6-8 meses y después es ganancia neta.

### Opción B: Venta (alternativa)

| Concepto | Valor |
|---|---|
| Precio de venta sugerido (valor justo) | US$10.000 - US$15.000 |
| Lo que probablemente ofrezcan | US$3.000 - US$5.000 |

**Si venden por US$3-5k:**
- ❌ No cubrís ni tu costo de producción.
- ❌ Perdés la propiedad.
- ❌ Cada mejora futura la tenés que negociar por separado.

**Si venden por US$10-15k:**
- ✅ Recuperás inversión con ganancia.
- ⚠️ Pero perdés el ingreso recurrente y la propiedad.
- ⚠️ Cada intervención futura (y las va a haber, porque el sistema va a crecer) la tenés que cobrar aparte, y eso genera fricción.

### Recomendación para la presentación

> [!IMPORTANT]
> **Presentá las dos opciones, pero hacé que la suscripción sea la opción obvia.**
> 
> Mostrá el valor de mercado del sistema (US$20-35k). Luego decí:
> _"Puedo ofrecerles dos caminos: comprarlo por US$[valor justo], o una suscripción mensual de US$[cuota] que incluye todo — hosting, soporte, actualizaciones y mi tiempo. La suscripción les sale más barata en los primeros años y siempre tienen el sistema actualizado."_
> 
> Si eligen comprar por el valor justo, bien. Si ofrecen US$3-5k, la respuesta es: _"Por ese valor no cubre el costo de desarrollo; la suscripción mensual es la mejor opción para ambos."_

---

## Open Questions

> [!IMPORTANT]
> **¿Estás de acuerdo con la estimación de 200-300 horas restantes?** ¿Sentís que es más o menos? Esto afecta directamente el costo total y el valor que presentamos.

> [!IMPORTANT]
> **¿A cuántas horas semanales le podés dedicar al desarrollo?** Esto define el timeline (cuántos meses faltan para tenerlo listo).

> [!IMPORTANT]
> **¿Querés que el valor hora tuyo en la presentación sea US$20, US$25 o US$30?** Esto depende de cómo te posicionar: si decís US$30, el valor total sube pero es más creíble como "precio de mercado".
