// Templates por defecto para todos los mails automáticos de InmoCoach
// Variables disponibles: {nombre}, {inmobiliaria}, {años}, {plural}, {meses}

export interface MailDefinition {
  key: string;
  label: string;
  emoji: string;
  description: string;
  when: string;
  category: "celebration" | "loyalty";
  defaultSubject: string;
  defaultBody: string;
}

export const MAIL_DEFINITIONS: MailDefinition[] = [
  // ── CUMPLEAÑOS ──
  {
    key: "birthday_agent",
    label: "Cumpleaños — al festejado",
    emoji: "🎂",
    description: "Se envía al agente el día de su cumpleaños",
    when: "Día del cumpleaños",
    category: "celebration",
    defaultSubject: "¡Feliz cumpleaños, {nombre}! 🎂",
    defaultBody: `¡Feliz cumpleaños, {nombre}!

Hoy es tu día y desde {inmobiliaria} queremos que lo disfrutes al máximo.

Gracias por ser parte de nuestro equipo. Tu compromiso y dedicación hacen la diferencia todos los días.

¡Que sea un año lleno de logros y buenas noticias!`,
  },
  {
    key: "birthday_team",
    label: "Cumpleaños — al equipo",
    emoji: "🎂",
    description: "Se envía a todos los compañeros el día anterior",
    when: "Día anterior al cumpleaños",
    category: "celebration",
    defaultSubject: "🎂 Mañana cumple años {nombre}",
    defaultBody: `¡Mañana es el cumpleaños de {nombre}!

Aprovechá para saludarlo/a y hacerle saber que el equipo piensa en él/ella.

Un detalle o mensaje a tiempo vale más de lo que imaginás.

— {inmobiliaria}`,
  },
  // ── ANIVERSARIO ──
  {
    key: "anniversary_agent",
    label: "Aniversario — al festejado",
    emoji: "🏡",
    description: "Se envía al agente el día de su aniversario en la empresa",
    when: "Día del aniversario",
    category: "celebration",
    defaultSubject: "¡{años} año{plural} en {inmobiliaria}, {nombre}! 🏡",
    defaultBody: `¡{nombre}, hoy se cumplen {años} año{plural} desde que te sumaste a {inmobiliaria}!

No es un número menor. Elegiste este camino y lo sostenés todos los días.

Gracias por tu confianza, tu esfuerzo y por seguir construyendo junto a nosotros.

¡A por muchos más!`,
  },
  {
    key: "anniversary_team",
    label: "Aniversario — al equipo",
    emoji: "🏡",
    description: "Se envía a todos los compañeros el día anterior",
    when: "Día anterior al aniversario",
    category: "celebration",
    defaultSubject: "🏡 Mañana {nombre} cumple {años} año{plural} en {inmobiliaria}",
    defaultBody: `¡Mañana {nombre} cumple {años} año{plural} en {inmobiliaria}!

Es una fecha especial. Si podés, mandále unas palabras — ese reconocimiento del equipo vale muchísimo.

— {inmobiliaria}`,
  },
  // ── FIDELIZACIÓN ──
  {
    key: "loyalty_month_1",
    label: "Fidelización — Mes 1",
    emoji: "📬",
    description: "Primer mes en la inmobiliaria. Foco en arrancar bien.",
    when: "30 días desde el aniversario",
    category: "loyalty",
    defaultSubject: "Tu primer mes en {inmobiliaria}, {nombre}",
    defaultBody: `Hola {nombre},

Ya pasó tu primer mes en {inmobiliaria} y quiero ser directo con vos.

El primer mes es el más difícil. Todo es nuevo, los tiempos son distintos a lo que esperabas y todavía no ves los resultados. Es normal. Lo que no es normal es esperar que los clientes lleguen solos.

Lo que yo necesito que hagas cada día, sin excusas:

→ Generá al menos 3 contactos nuevos por día. Llamadas, WhatsApps, referidos, puerta a puerta. El que no contacta, no vende.
→ Cargá tus reuniones en el sistema. Lo que no se mide no existe.
→ Si tenés dudas, preguntame. No hay pregunta estúpida cuando recién arrancás.

Tenés todo para hacerlo bien. Ahora es momento de demostrarlo.

{nombre}, este negocio se construye en los primeros 90 días. Arrancaste. Seguí.

— {inmobiliaria}`,
  },
  {
    key: "loyalty_month_2",
    label: "Fidelización — Mes 2",
    emoji: "📬",
    description: "Segundo mes. El entusiasmo baja — hay que sostener el ritmo.",
    when: "60 días desde el aniversario",
    category: "loyalty",
    defaultSubject: "Dos meses: ¿cómo viene el ritmo, {nombre}?",
    defaultBody: `Hola {nombre},

Dos meses. Ya pasó el entusiasmo del arranque y estamos en la parte más honesta del proceso.

Quiero hacerte una pregunta directa: ¿estás generando contactos todos los días?

No te pregunto si tenés ganas. Te pregunto si lo estás haciendo.

El mes 2 es donde se define quién va a ser profesional en esto y quién no. No porque no tengan talento, sino porque dejan de hacer lo básico cuando no ven resultados inmediatos.

Lo básico es esto:
→ Contactos diarios. Siempre.
→ Seguimiento de cada consulta. Sin excepción.
→ Conocer cada propiedad de nuestra cartera. El que no conoce lo que vende, no vende.

Si algo no está funcionando, hablemos. Prefiero saberlo ahora que en tres meses.

Seguí. Esto se construye con días, no con inspiración.

— {inmobiliaria}`,
  },
  {
    key: "loyalty_month_3",
    label: "Fidelización — Mes 3",
    emoji: "📬",
    description: "Tercer mes. Primer balance real de resultados y pipeline.",
    when: "90 días desde el aniversario",
    category: "loyalty",
    defaultSubject: "3 meses en {inmobiliaria} — es momento de hacer balance",
    defaultBody: `Hola {nombre},

Tres meses. Es el primer momento en que podemos hablar de resultados reales.

Quiero que te hagas estas preguntas hoy:

¿Tenés pipeline? Es decir, ¿hay operaciones en curso, aunque todavía no cerraron?
¿Generás contactos nuevos cada semana, o vivís de los que ya tenés?
¿Sabés exactamente cuántas reuniones tuviste este mes?

Si la respuesta a alguna de estas es "no" o "no sé", eso es lo que tenemos que trabajar.

Los tres meses son el momento bisagra. Los que llegaron a esta instancia con contactos activos y reuniones en el calendario, generalmente terminan bien el año. Los que no, suelen salir en los próximos 60 días.

Yo quiero que vos estés en el primer grupo.

¿Qué necesitás de mi parte para que eso pase?

— {inmobiliaria}`,
  },
  {
    key: "loyalty_month_6",
    label: "Fidelización — Mes 6",
    emoji: "📬",
    description: "Sexto mes. Compromiso de largo plazo y proyección.",
    when: "180 días desde el aniversario",
    category: "loyalty",
    defaultSubject: "6 meses en {inmobiliaria}: ya no sos nuevo, {nombre}",
    defaultBody: `Hola {nombre},

Seis meses. Ya no sos el/la nuevo/a del equipo.

Eso tiene un peso enorme que quiero que entiendas: ya tenés experiencia real en este mercado, en nuestra forma de trabajar, en nuestros clientes. Ese conocimiento vale.

Ahora la pregunta es qué vas a hacer con todo eso.

Los próximos seis meses son distintos a los primeros. Ya no se trata de aprender cómo funciona todo. Se trata de construir tu propia cartera, tu propia red de referidos, tu propio nombre en el mercado.

Lo que espero de vos a partir de hoy:
→ Que tengas al menos 10 contactos activos en seguimiento permanente.
→ Que cada cliente satisfecho te genere al menos un referido.
→ Que pienses en tu trabajo como un negocio propio dentro de {inmobiliaria}.

Tenés seis meses de base. Ahora es momento de construir.

Estoy para lo que necesites.

— {inmobiliaria}`,
  },
  {
    key: "loyalty_annual",
    label: "Fidelización — Anual",
    emoji: "📬",
    description: "Un año completo. Reconocimiento y visión de futuro.",
    when: "365 días desde el aniversario",
    category: "loyalty",
    defaultSubject: "Un año en {inmobiliaria}, {nombre} — gracias de verdad",
    defaultBody: `Hola {nombre},

Un año.

No es un número menor. En este negocio, llegar a un año con resultados y ganas de seguir dice mucho de vos.

Quiero agradecerte de verdad. Por la constancia, por los días difíciles que igual apareciste, por confiar en {inmobiliaria} como el lugar donde construir tu carrera.

Este negocio es duro. Sabemos los dos que hay días en que las ganas no alcanzan y hay que ir igual. Y vos fuiste.

Ahora viene la parte que más me interesa: ¿qué querés construir en el próximo año?

No te pregunto metas de ventas. Te pregunto qué querés que sea diferente en tu vida y en tu trabajo dentro de doce meses.

Cuando tengas ganas, hablemos. Me interesa que el segundo año sea mejor que el primero.

Gracias, {nombre}.

— {inmobiliaria}`,
  },
];

export function getMailDef(key: string): MailDefinition | undefined {
  return MAIL_DEFINITIONS.find(m => m.key === key);
}
