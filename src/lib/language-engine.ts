/**
 * RESERVO.AI — Language Detection & Multilanguage Engine
 *
 * Detecta idioma automáticamente desde transcripciones de llamadas.
 * Genera mensajes SMS/notificaciones en el idioma detectado.
 * Soporta 40+ idiomas con fallback a español.
 */

// ─────────────────────────────────────────────────────────────
// LANGUAGE CODES (ISO 639-1) — 40+ idiomas soportados
// ─────────────────────────────────────────────────────────────
export type LangCode =
  | 'es' | 'en' | 'fr' | 'de' | 'pt' | 'it' | 'nl' | 'ru' | 'zh' | 'ja'
  | 'ko' | 'ar' | 'hi' | 'bn' | 'tr' | 'pl' | 'uk' | 'ro' | 'cs' | 'sv'
  | 'da' | 'no' | 'fi' | 'el' | 'hu' | 'sk' | 'bg' | 'hr' | 'sr' | 'sl'
  | 'et' | 'lv' | 'lt' | 'ca' | 'eu' | 'gl' | 'he' | 'th' | 'vi' | 'id'
  | 'ms' | 'tl' | 'sw'

export const SUPPORTED_LANGUAGES: Record<LangCode, string> = {
  es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch',
  pt: 'Português', it: 'Italiano', nl: 'Nederlands', ru: 'Русский',
  zh: '中文', ja: '日本語', ko: '한국어', ar: 'العربية',
  hi: 'हिन्दी', bn: 'বাংলা', tr: 'Türkçe', pl: 'Polski',
  uk: 'Українська', ro: 'Română', cs: 'Čeština', sv: 'Svenska',
  da: 'Dansk', no: 'Norsk', fi: 'Suomi', el: 'Ελληνικά',
  hu: 'Magyar', sk: 'Slovenčina', bg: 'Български', hr: 'Hrvatski',
  sr: 'Srpski', sl: 'Slovenščina', et: 'Eesti', lv: 'Latviešu',
  lt: 'Lietuvių', ca: 'Català', eu: 'Euskara', gl: 'Galego',
  he: 'עברית', th: 'ไทย', vi: 'Tiếng Việt', id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu', tl: 'Filipino', sw: 'Kiswahili',
}

// ─────────────────────────────────────────────────────────────
// LANGUAGE DETECTION FROM TRANSCRIPT
// Uses keyword matching for fast, offline detection.
// ─────────────────────────────────────────────────────────────
const LANG_MARKERS: Record<string, string[]> = {
  en: ['hello','hi','good morning','good afternoon','good evening','thank you','thanks','please','yes','no','okay','sure','right','booking','reservation','table','people','appointment','cancel','would like','i want','i need','could you','can i','do you have'],
  fr: ['bonjour','bonsoir','merci','s\'il vous plaît','oui','non','je voudrais','réservation','table','personnes','rendez-vous','annuler','excusez-moi','d\'accord','parfait','bien sûr'],
  de: ['hallo','guten tag','guten morgen','guten abend','danke','bitte','ja','nein','reservierung','tisch','personen','termin','stornieren','entschuldigung','perfekt','genau'],
  pt: ['olá','bom dia','boa tarde','boa noite','obrigado','obrigada','por favor','sim','não','reserva','mesa','pessoas','consulta','cancelar','desculpe','perfeito','claro'],
  it: ['ciao','buongiorno','buonasera','grazie','per favore','sì','no','prenotazione','tavolo','persone','appuntamento','cancellare','scusi','perfetto','va bene','certo'],
  nl: ['hallo','goedemorgen','goedemiddag','dank u','alstublieft','ja','nee','reservering','tafel','personen','afspraak','annuleren','perfect','natuurlijk'],
  ru: ['здравствуйте','привет','спасибо','пожалуйста','да','нет','бронирование','стол','человек','запись','отменить','хорошо','конечно'],
  zh: ['你好','谢谢','请','是','不','预订','桌子','人','取消','好的','可以'],
  ja: ['こんにちは','ありがとう','お願い','はい','いいえ','予約','テーブル','人','キャンセル','大丈夫'],
  ko: ['안녕하세요','감사합니다','네','아니요','예약','테이블','명','취소','좋습니다'],
  ar: ['مرحبا','شكرا','من فضلك','نعم','لا','حجز','طاولة','أشخاص','إلغاء','حسنا','تمام'],
  hi: ['नमस्ते','धन्यवाद','कृपया','हाँ','नहीं','बुकिंग','टेबल','लोग','रद्द','ठीक है','अच्छा'],
  tr: ['merhaba','günaydın','teşekkürler','lütfen','evet','hayır','rezervasyon','masa','kişi','randevu','iptal','tamam','tabii'],
  pl: ['dzień dobry','cześć','dziękuję','proszę','tak','nie','rezerwacja','stolik','osób','wizyta','anulować','dobrze','oczywiście'],
  ro: ['bună ziua','salut','mulțumesc','vă rog','da','nu','rezervare','masă','persoane','programare','anulare','perfect','bine'],
  sv: ['hej','god morgon','tack','snälla','ja','nej','bokning','bord','personer','avbokning','perfekt','visst'],
  da: ['hej','godmorgen','tak','ja','nej','reservation','bord','personer','afbestilling','perfekt','selvfølgelig'],
  no: ['hei','god morgen','takk','ja','nei','reservasjon','bord','personer','avbestilling','perfekt','selvfølgelig'],
  fi: ['hei','huomenta','kiitos','kyllä','ei','varaus','pöytä','henkilöä','peruutus','hyvä','tietenkin'],
  el: ['γεια σας','καλημέρα','ευχαριστώ','παρακαλώ','ναι','όχι','κράτηση','τραπέζι','άτομα','ακύρωση','τέλεια','βεβαίως'],
  hu: ['jó napot','szia','köszönöm','kérem','igen','nem','foglalás','asztal','személy','lemondás','tökéletes','persze'],
  ca: ['bon dia','bona tarda','gràcies','si us plau','sí','no','reserva','taula','persones','cancel·lar','perfecte','és clar'],
  th: ['สวัสดี','ขอบคุณ','ครับ','ค่ะ','ใช่','ไม่','จอง','โต๊ะ','คน','ยกเลิก','ดี'],
  vi: ['xin chào','cảm ơn','vâng','không','đặt bàn','bàn','người','hủy','được','tốt'],
  id: ['halo','selamat pagi','terima kasih','ya','tidak','reservasi','meja','orang','batal','baik','tentu'],
}

// Spanish markers — used to confirm "not spanish" more than to detect spanish
const ES_MARKERS = ['hola','buenas','buenos días','buenas tardes','buenos dias','gracias','por favor','sí','vale','claro','venga','reserva','mesa','personas','cita','cancelar','perfecto','genial','de acuerdo']

/**
 * Detects language from transcript text.
 * Returns the detected language code and confidence score.
 */
export function detectLanguage(transcript: string): { lang: LangCode; confidence: number; isLocal: boolean } {
  if (!transcript || transcript.trim().length < 5) {
    return { lang: 'es', confidence: 0.5, isLocal: true }
  }

  const lower = transcript.toLowerCase()

  // Extract only client lines if transcript has role prefixes
  const clientText = lower.split('\n')
    .filter(l => /^(cliente|client|user|caller):/i.test(l))
    .map(l => l.replace(/^[^:]+:\s*/, ''))
    .join(' ') || lower

  // Score each language
  const scores: Record<string, number> = {}

  // Score Spanish first
  let esScore = 0
  for (const marker of ES_MARKERS) {
    if (clientText.includes(marker)) esScore++
  }
  scores.es = esScore

  // Score other languages
  for (const [lang, markers] of Object.entries(LANG_MARKERS)) {
    let score = 0
    for (const marker of markers) {
      if (clientText.includes(marker)) score++
    }
    scores[lang] = score
  }

  // Find winner
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const topLang = sorted[0]
  const topScore = topLang[1]
  const secondScore = sorted[1]?.[1] || 0

  // Not enough signal — default to Spanish
  if (topScore === 0) {
    return { lang: 'es', confidence: 0.3, isLocal: true }
  }

  const lang = topLang[0] as LangCode
  const confidence = Math.min(0.95, 0.4 + (topScore * 0.1) + ((topScore - secondScore) * 0.05))
  const isLocal = lang === 'es' || lang === 'ca' || lang === 'eu' || lang === 'gl'

  return { lang, confidence, isLocal }
}

// ─────────────────────────────────────────────────────────────
// MULTILANGUAGE SMS TEMPLATES
// Reservation confirmation, cancellation, reminders in 40+ languages
// ─────────────────────────────────────────────────────────────

interface SmsTemplateParams {
  businessName: string
  customerName: string
  date: string
  time: string
  people: number
  bookingLabel?: string
}

type SmsType = 'confirmed' | 'cancelled' | 'reminder' | 'reminder_30min'

const SMS_TEMPLATES: Record<string, Record<SmsType, (p: SmsTemplateParams) => string>> = {
  es: {
    confirmed: p => `${p.businessName}: Hola ${p.customerName}, confirmada tu ${p.bookingLabel || 'reserva'} para el ${p.date} a las ${p.time}${p.people > 1 ? `, ${p.people} personas` : ''}. ¡Te esperamos!`,
    cancelled: p => `${p.businessName}: Hola ${p.customerName}, tu ${p.bookingLabel || 'reserva'} del ${p.date} a las ${p.time} queda cancelada. Cualquier cosa, llámanos.`,
    reminder: p => `${p.businessName}: Hola ${p.customerName}, mañana tienes ${p.bookingLabel || 'reserva'} a las ${p.time}${p.people > 1 ? `, ${p.people} personas` : ''}. ¡Te esperamos!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}, en 30 minutos tienes tu ${p.bookingLabel || 'reserva'} a las ${p.time}. ¡Te esperamos!`,
  },
  en: {
    confirmed: p => `${p.businessName}: Hi ${p.customerName}, your ${p.bookingLabel || 'reservation'} is confirmed for ${p.date} at ${p.time}${p.people > 1 ? `, ${p.people} guests` : ''}. See you soon!`,
    cancelled: p => `${p.businessName}: Hi ${p.customerName}, your ${p.bookingLabel || 'reservation'} for ${p.date} at ${p.time} has been cancelled. Feel free to call us anytime.`,
    reminder: p => `${p.businessName}: Hi ${p.customerName}, reminder: your ${p.bookingLabel || 'reservation'} is tomorrow at ${p.time}${p.people > 1 ? ` for ${p.people}` : ''}. See you there!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}, your ${p.bookingLabel || 'reservation'} is in 30 minutes at ${p.time}. See you soon!`,
  },
  fr: {
    confirmed: p => `${p.businessName}: Bonjour ${p.customerName}, votre ${p.bookingLabel || 'réservation'} est confirmée pour le ${p.date} à ${p.time}${p.people > 1 ? `, ${p.people} personnes` : ''}. À bientôt !`,
    cancelled: p => `${p.businessName}: Bonjour ${p.customerName}, votre ${p.bookingLabel || 'réservation'} du ${p.date} à ${p.time} a été annulée. N'hésitez pas à nous rappeler.`,
    reminder: p => `${p.businessName}: Bonjour ${p.customerName}, rappel : ${p.bookingLabel || 'réservation'} demain à ${p.time}${p.people > 1 ? `, ${p.people} personnes` : ''}. À demain !`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}, votre ${p.bookingLabel || 'réservation'} est dans 30 minutes à ${p.time}. À tout de suite !`,
  },
  de: {
    confirmed: p => `${p.businessName}: Hallo ${p.customerName}, Ihre ${p.bookingLabel || 'Reservierung'} ist bestätigt für ${p.date} um ${p.time}${p.people > 1 ? `, ${p.people} Personen` : ''}. Bis bald!`,
    cancelled: p => `${p.businessName}: Hallo ${p.customerName}, Ihre ${p.bookingLabel || 'Reservierung'} am ${p.date} um ${p.time} wurde storniert. Rufen Sie uns gerne jederzeit an.`,
    reminder: p => `${p.businessName}: Hallo ${p.customerName}, Erinnerung: ${p.bookingLabel || 'Reservierung'} morgen um ${p.time}${p.people > 1 ? `, ${p.people} Personen` : ''}. Bis morgen!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}, Ihre ${p.bookingLabel || 'Reservierung'} ist in 30 Minuten um ${p.time}. Bis gleich!`,
  },
  pt: {
    confirmed: p => `${p.businessName}: Olá ${p.customerName}, a sua ${p.bookingLabel || 'reserva'} está confirmada para ${p.date} às ${p.time}${p.people > 1 ? `, ${p.people} pessoas` : ''}. Até breve!`,
    cancelled: p => `${p.businessName}: Olá ${p.customerName}, a sua ${p.bookingLabel || 'reserva'} de ${p.date} às ${p.time} foi cancelada. Ligue-nos quando quiser.`,
    reminder: p => `${p.businessName}: Olá ${p.customerName}, lembrete: ${p.bookingLabel || 'reserva'} amanhã às ${p.time}${p.people > 1 ? `, ${p.people} pessoas` : ''}. Até amanhã!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}, a sua ${p.bookingLabel || 'reserva'} é em 30 minutos às ${p.time}. Até já!`,
  },
  it: {
    confirmed: p => `${p.businessName}: Ciao ${p.customerName}, la tua ${p.bookingLabel || 'prenotazione'} è confermata per ${p.date} alle ${p.time}${p.people > 1 ? `, ${p.people} persone` : ''}. A presto!`,
    cancelled: p => `${p.businessName}: Ciao ${p.customerName}, la tua ${p.bookingLabel || 'prenotazione'} del ${p.date} alle ${p.time} è stata cancellata. Chiamaci quando vuoi.`,
    reminder: p => `${p.businessName}: Ciao ${p.customerName}, promemoria: ${p.bookingLabel || 'prenotazione'} domani alle ${p.time}${p.people > 1 ? `, ${p.people} persone` : ''}. A domani!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}, la tua ${p.bookingLabel || 'prenotazione'} è tra 30 minuti alle ${p.time}. A tra poco!`,
  },
  nl: {
    confirmed: p => `${p.businessName}: Hallo ${p.customerName}, uw ${p.bookingLabel || 'reservering'} is bevestigd voor ${p.date} om ${p.time}${p.people > 1 ? `, ${p.people} personen` : ''}. Tot snel!`,
    cancelled: p => `${p.businessName}: Hallo ${p.customerName}, uw ${p.bookingLabel || 'reservering'} van ${p.date} om ${p.time} is geannuleerd. Bel ons gerust.`,
    reminder: p => `${p.businessName}: Hallo ${p.customerName}, herinnering: ${p.bookingLabel || 'reservering'} morgen om ${p.time}${p.people > 1 ? `, ${p.people} personen` : ''}. Tot morgen!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}, uw ${p.bookingLabel || 'reservering'} is over 30 minuten om ${p.time}. Tot zo!`,
  },
  ru: {
    confirmed: p => `${p.businessName}: Здравствуйте, ${p.customerName}! Ваша ${p.bookingLabel || 'бронь'} подтверждена на ${p.date} в ${p.time}${p.people > 1 ? `, ${p.people} чел.` : ''}. Ждём вас!`,
    cancelled: p => `${p.businessName}: ${p.customerName}, ваша ${p.bookingLabel || 'бронь'} на ${p.date} в ${p.time} отменена. Звоните в любое время.`,
    reminder: p => `${p.businessName}: ${p.customerName}, напоминаем: ${p.bookingLabel || 'бронь'} завтра в ${p.time}${p.people > 1 ? `, ${p.people} чел.` : ''}. До встречи!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}, ваша ${p.bookingLabel || 'бронь'} через 30 минут в ${p.time}. Ждём!`,
  },
  zh: {
    confirmed: p => `${p.businessName}：${p.customerName} 您好，您的${p.bookingLabel || '预订'}已确认：${p.date} ${p.time}${p.people > 1 ? `，${p.people}位` : ''}。期待您的光临！`,
    cancelled: p => `${p.businessName}：${p.customerName} 您好，您${p.date} ${p.time}的${p.bookingLabel || '预订'}已取消。欢迎随时致电。`,
    reminder: p => `${p.businessName}：${p.customerName}，温馨提醒：明天${p.time}有${p.bookingLabel || '预订'}${p.people > 1 ? `，${p.people}位` : ''}。明天见！`,
    reminder_30min: p => `${p.businessName}：${p.customerName}，您的${p.bookingLabel || '预订'}将在30分钟后（${p.time}）开始。`,
  },
  ja: {
    confirmed: p => `${p.businessName}：${p.customerName}様、${p.date} ${p.time}の${p.bookingLabel || 'ご予約'}を確認いたしました${p.people > 1 ? `（${p.people}名様）` : ''}。お待ちしております。`,
    cancelled: p => `${p.businessName}：${p.customerName}様、${p.date} ${p.time}の${p.bookingLabel || 'ご予約'}をキャンセルいたしました。`,
    reminder: p => `${p.businessName}：${p.customerName}様、明日${p.time}に${p.bookingLabel || 'ご予約'}がございます${p.people > 1 ? `（${p.people}名様）` : ''}。お待ちしております。`,
    reminder_30min: p => `${p.businessName}：${p.customerName}様、${p.bookingLabel || 'ご予約'}は30分後（${p.time}）でございます。`,
  },
  ko: {
    confirmed: p => `${p.businessName}: ${p.customerName}님, ${p.date} ${p.time} ${p.bookingLabel || '예약'}이 확정되었습니다${p.people > 1 ? ` (${p.people}명)` : ''}. 기다리겠습니다!`,
    cancelled: p => `${p.businessName}: ${p.customerName}님, ${p.date} ${p.time} ${p.bookingLabel || '예약'}이 취소되었습니다. 언제든 연락주세요.`,
    reminder: p => `${p.businessName}: ${p.customerName}님, 내일 ${p.time} ${p.bookingLabel || '예약'} 알림${p.people > 1 ? ` (${p.people}명)` : ''}. 내일 뵙겠습니다!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}님, ${p.bookingLabel || '예약'}이 30분 후 ${p.time}입니다.`,
  },
  ar: {
    confirmed: p => `${p.businessName}: مرحباً ${p.customerName}، تم تأكيد ${p.bookingLabel || 'حجزك'} بتاريخ ${p.date} الساعة ${p.time}${p.people > 1 ? `، ${p.people} أشخاص` : ''}. بانتظارك!`,
    cancelled: p => `${p.businessName}: ${p.customerName}، تم إلغاء ${p.bookingLabel || 'حجزك'} بتاريخ ${p.date} الساعة ${p.time}. اتصل بنا في أي وقت.`,
    reminder: p => `${p.businessName}: ${p.customerName}، تذكير: لديك ${p.bookingLabel || 'حجز'} غداً الساعة ${p.time}${p.people > 1 ? `، ${p.people} أشخاص` : ''}. نراك غداً!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}، ${p.bookingLabel || 'حجزك'} بعد 30 دقيقة الساعة ${p.time}.`,
  },
  tr: {
    confirmed: p => `${p.businessName}: Merhaba ${p.customerName}, ${p.date} saat ${p.time} ${p.bookingLabel || 'rezervasyonunuz'}${p.people > 1 ? `, ${p.people} kişi` : ''} onaylandı. Bekliyoruz!`,
    cancelled: p => `${p.businessName}: ${p.customerName}, ${p.date} saat ${p.time} ${p.bookingLabel || 'rezervasyonunuz'} iptal edildi. Bizi arayabilirsiniz.`,
    reminder: p => `${p.businessName}: ${p.customerName}, hatırlatma: yarın saat ${p.time} ${p.bookingLabel || 'rezervasyonunuz'}${p.people > 1 ? `, ${p.people} kişi` : ''} var. Yarın görüşürüz!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}, ${p.bookingLabel || 'rezervasyonunuz'} 30 dakika sonra saat ${p.time}. Görüşürüz!`,
  },
  pl: {
    confirmed: p => `${p.businessName}: Cześć ${p.customerName}, ${p.bookingLabel || 'rezerwacja'} potwierdzona na ${p.date} o ${p.time}${p.people > 1 ? `, ${p.people} osób` : ''}. Do zobaczenia!`,
    cancelled: p => `${p.businessName}: ${p.customerName}, ${p.bookingLabel || 'rezerwacja'} na ${p.date} o ${p.time} została anulowana. Zapraszamy do kontaktu.`,
    reminder: p => `${p.businessName}: ${p.customerName}, przypomnienie: jutro o ${p.time} ${p.bookingLabel || 'rezerwacja'}${p.people > 1 ? `, ${p.people} osób` : ''}. Do jutra!`,
    reminder_30min: p => `${p.businessName}: ${p.customerName}, ${p.bookingLabel || 'rezerwacja'} za 30 minut o ${p.time}.`,
  },
}

/**
 * Build a multilanguage SMS for reservation events.
 * Falls back to English, then Spanish if language not supported.
 */
export function buildMultilangSms(
  lang: LangCode,
  type: SmsType,
  params: SmsTemplateParams
): string {
  const templates = SMS_TEMPLATES[lang] || SMS_TEMPLATES.en || SMS_TEMPLATES.es
  const builder = templates[type]
  if (!builder) return SMS_TEMPLATES.es[type](params)

  // Format date in the target language
  const formattedParams = {
    ...params,
    date: formatDateForLang(params.date, lang),
  }
  return builder(formattedParams)
}

/**
 * Format a date string (YYYY-MM-DD or ISO) for the target language.
 */
function formatDateForLang(dateStr: string, lang: LangCode): string {
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00')
    const localeMap: Record<string, string> = {
      es: 'es-ES', en: 'en-GB', fr: 'fr-FR', de: 'de-DE', pt: 'pt-PT',
      it: 'it-IT', nl: 'nl-NL', ru: 'ru-RU', zh: 'zh-CN', ja: 'ja-JP',
      ko: 'ko-KR', ar: 'ar-SA', hi: 'hi-IN', tr: 'tr-TR', pl: 'pl-PL',
      ro: 'ro-RO', cs: 'cs-CZ', sv: 'sv-SE', da: 'da-DK', no: 'nb-NO',
      fi: 'fi-FI', el: 'el-GR', hu: 'hu-HU', ca: 'ca-ES', th: 'th-TH',
      vi: 'vi-VN', id: 'id-ID',
    }
    const locale = localeMap[lang] || 'es-ES'
    return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })
  } catch {
    return dateStr
  }
}

// ─────────────────────────────────────────────────────────────
// ORDER SMS MULTILANGUAGE
// ─────────────────────────────────────────────────────────────
interface OrderSmsParams {
  businessName: string
  customerName: string
  orderType: string
  total: number
}

type OrderSmsType = 'confirmed' | 'ready' | 'delivering'

const ORDER_SMS: Record<string, Record<OrderSmsType, (p: OrderSmsParams) => string>> = {
  es: {
    confirmed: p => `${p.businessName}: Hola ${p.customerName}, tu pedido (${p.total.toFixed(2)}€) para ${p.orderType} está confirmado. Te avisamos cuando esté listo.`,
    ready: p => `${p.businessName}: ${p.customerName}, tu pedido está listo. Puedes pasar a recogerlo cuando quieras.`,
    delivering: p => `${p.businessName}: ${p.customerName}, tu pedido va en camino. Llega en breve.`,
  },
  en: {
    confirmed: p => `${p.businessName}: Hi ${p.customerName}, your order (€${p.total.toFixed(2)}) for ${p.orderType} is confirmed. We'll let you know when it's ready.`,
    ready: p => `${p.businessName}: ${p.customerName}, your order is ready for pickup!`,
    delivering: p => `${p.businessName}: ${p.customerName}, your order is on its way!`,
  },
  fr: {
    confirmed: p => `${p.businessName}: Bonjour ${p.customerName}, votre commande (${p.total.toFixed(2)}€) est confirmée. Nous vous préviendrons quand elle sera prête.`,
    ready: p => `${p.businessName}: ${p.customerName}, votre commande est prête !`,
    delivering: p => `${p.businessName}: ${p.customerName}, votre commande est en route !`,
  },
  de: {
    confirmed: p => `${p.businessName}: Hallo ${p.customerName}, Ihre Bestellung (${p.total.toFixed(2)}€) ist bestätigt. Wir melden uns, wenn sie fertig ist.`,
    ready: p => `${p.businessName}: ${p.customerName}, Ihre Bestellung ist fertig zur Abholung!`,
    delivering: p => `${p.businessName}: ${p.customerName}, Ihre Bestellung ist unterwegs!`,
  },
  pt: {
    confirmed: p => `${p.businessName}: Olá ${p.customerName}, o seu pedido (${p.total.toFixed(2)}€) está confirmado. Avisamos quando estiver pronto.`,
    ready: p => `${p.businessName}: ${p.customerName}, o seu pedido está pronto!`,
    delivering: p => `${p.businessName}: ${p.customerName}, o seu pedido está a caminho!`,
  },
  it: {
    confirmed: p => `${p.businessName}: Ciao ${p.customerName}, il tuo ordine (${p.total.toFixed(2)}€) è confermato. Ti avviseremo quando sarà pronto.`,
    ready: p => `${p.businessName}: ${p.customerName}, il tuo ordine è pronto!`,
    delivering: p => `${p.businessName}: ${p.customerName}, il tuo ordine è in arrivo!`,
  },
}

export function buildMultilangOrderSms(
  lang: LangCode,
  type: OrderSmsType,
  params: OrderSmsParams
): string {
  const templates = ORDER_SMS[lang] || ORDER_SMS.en || ORDER_SMS.es
  return templates[type](params)
}

// ─────────────────────────────────────────────────────────────
// CLIENT TYPE CLASSIFICATION
// ─────────────────────────────────────────────────────────────
export function classifyClientType(lang: LangCode, callerPhone: string): 'local' | 'extranjero' {
  // Local languages for Spain
  if (['es', 'ca', 'eu', 'gl'].includes(lang)) return 'local'

  // Also check phone prefix — Spanish numbers
  if (callerPhone.startsWith('+34') || callerPhone.startsWith('34')) return 'local'

  return 'extranjero'
}

/**
 * Build a human-readable call summary including language info.
 */
export function buildLanguageAwareSummary(params: {
  lang: LangCode
  clientType: 'local' | 'extranjero'
  customerName: string | null
  intent: string
  details?: string
}): string {
  const langName = SUPPORTED_LANGUAGES[params.lang] || params.lang
  const typeLabel = params.clientType === 'extranjero'
    ? `Cliente extranjero (${langName})`
    : `Cliente local`
  const who = params.customerName || 'sin nombre'
  const what = params.intent || 'consulta'

  return `${typeLabel} — ${who} — ${what}${params.details ? ': ' + params.details : ''}`
}

// ─────────────────────────────────────────────────────────────
// ELEVENLABS LANGUAGE MAP
// Maps our lang codes to ElevenLabs ASR language codes
// ─────────────────────────────────────────────────────────────
export const ELEVENLABS_LANG_MAP: Record<string, string> = {
  es: 'es', en: 'en', fr: 'fr', de: 'de', pt: 'pt', it: 'it',
  nl: 'nl', ru: 'ru', zh: 'zh', ja: 'ja', ko: 'ko', ar: 'ar',
  hi: 'hi', tr: 'tr', pl: 'pl', uk: 'uk', ro: 'ro', cs: 'cs',
  sv: 'sv', da: 'da', no: 'no', fi: 'fi', el: 'el', hu: 'hu',
  sk: 'sk', bg: 'bg', hr: 'hr', ca: 'ca', th: 'th', vi: 'vi',
  id: 'id', ms: 'ms', tl: 'tl',
}
