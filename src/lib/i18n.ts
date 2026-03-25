/**
 * RESERVO.AI — Sistema de internacionalización
 * Soporta: es (español), en (english), fr (français), pt (português), ca (català)
 *
 * Uso: const t = getTranslations('es')
 *      t.nav.panel → "Resumen del día"
 */

export type Locale = 'es' | 'en' | 'fr' | 'pt' | 'ca'

export interface Translations {
  locale: Locale
  common: {
    save: string; cancel: string; delete: string; edit: string; close: string
    loading: string; error: string; success: string; confirm: string
    search: string; export: string; back: string; next: string; all: string
    yes: string; no: string; or: string; and: string
  }
  nav: {
    panel: string; reservations: string; agenda: string; calls: string
    clients: string; spaces: string; shifts: string; products: string
    orders: string; stats: string; billing: string; agent: string; settings: string
  }
  agent: {
    greeting: string; agentActive: string; agentInactive: string
    callCompleted: string; callMissed: string; callInProgress: string
  }
  reservations: {
    confirmed: string; pending: string; cancelled: string; completed: string; noShow: string
    newReservation: string; noReservations: string; people: string; table: string
  }
  clients: {
    newClient: string; noClients: string; vip: string; score: string
    visits: string; lastVisit: string; notes: string
  }
  orders: {
    newOrder: string; collecting: string; confirmed: string; ready: string
    delivering: string; delivered: string; pickup: string; delivery: string
  }
  insights: {
    detected: string; conversionUp: string; conversionDown: string
    peakHour: string; repeatCustomer: string; learning: string
    capacityHigh: string; noShowRisk: string; newCustomers: string
  }
  sms: {
    reservationConfirmed: string; reservationCancelled: string
    reminder: string; orderConfirmed: string; orderReady: string
  }
}

const ES: Translations = {
  locale: 'es',
  common: {
    save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar', close: 'Cerrar',
    loading: 'Cargando...', error: 'Error', success: 'Hecho', confirm: 'Confirmar',
    search: 'Buscar', export: 'Exportar', back: 'Atrás', next: 'Siguiente', all: 'Todas',
    yes: 'Sí', no: 'No', or: 'o', and: 'y',
  },
  nav: {
    panel: 'Resumen del día', reservations: 'Reservas', agenda: 'Agenda', calls: 'Llamadas',
    clients: 'Clientes', spaces: 'Mesas y zonas', shifts: 'Turnos y franjas', products: 'Carta y productos',
    orders: 'Pedidos', stats: 'Estadísticas', billing: 'Facturación', agent: 'Mi recepcionista', settings: 'Configuración',
  },
  agent: {
    greeting: 'Buenas, dígame', agentActive: 'activa', agentInactive: 'Sin número asignado',
    callCompleted: 'Llamada completada', callMissed: 'Llamada perdida', callInProgress: 'En curso',
  },
  reservations: {
    confirmed: 'Confirmada', pending: 'Pendiente', cancelled: 'Cancelada', completed: 'Completada', noShow: 'No presentado',
    newReservation: 'Nueva reserva', noReservations: 'Sin reservas', people: 'personas', table: 'Mesa',
  },
  clients: {
    newClient: 'Nuevo cliente', noClients: 'Sin clientes', vip: 'VIP', score: 'Puntuación',
    visits: 'visitas', lastVisit: 'Última visita', notes: 'Notas',
  },
  orders: {
    newOrder: 'Nuevo pedido', collecting: 'Tomando pedido', confirmed: 'Confirmado', ready: 'Listo',
    delivering: 'En reparto', delivered: 'Entregado', pickup: 'Recoger', delivery: 'Domicilio',
  },
  insights: {
    detected: 'Sofía ha detectado', conversionUp: 'Oye, vas para arriba', conversionDown: 'Ojo, la conversión ha bajado',
    peakHour: 'Ahora es cuando más te llaman', repeatCustomer: 'es de los que siempre vuelve',
    learning: 'Tu recepcionista está aprendiendo', capacityHigh: 'Hoy viene gente, ¿eh?',
    noShowRisk: 'reservas podrían no presentarse', newCustomers: 'caras nuevas esta semana',
  },
  sms: {
    reservationConfirmed: 'tu reserva está confirmada', reservationCancelled: 'tu reserva ha sido cancelada',
    reminder: 'te recordamos tu reserva para mañana', orderConfirmed: 'tu pedido está confirmado',
    orderReady: 'tu pedido está listo',
  },
}

const EN: Translations = {
  locale: 'en',
  common: {
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', close: 'Close',
    loading: 'Loading...', error: 'Error', success: 'Done', confirm: 'Confirm',
    search: 'Search', export: 'Export', back: 'Back', next: 'Next', all: 'All',
    yes: 'Yes', no: 'No', or: 'or', and: 'and',
  },
  nav: {
    panel: 'Dashboard', reservations: 'Reservations', agenda: 'Schedule', calls: 'Calls',
    clients: 'Clients', spaces: 'Tables & zones', shifts: 'Shifts', products: 'Menu & products',
    orders: 'Orders', stats: 'Analytics', billing: 'Billing', agent: 'My receptionist', settings: 'Settings',
  },
  agent: {
    greeting: 'Hello, how can I help?', agentActive: 'active', agentInactive: 'No number assigned',
    callCompleted: 'Call completed', callMissed: 'Missed call', callInProgress: 'In progress',
  },
  reservations: {
    confirmed: 'Confirmed', pending: 'Pending', cancelled: 'Cancelled', completed: 'Completed', noShow: 'No show',
    newReservation: 'New reservation', noReservations: 'No reservations', people: 'people', table: 'Table',
  },
  clients: {
    newClient: 'New client', noClients: 'No clients', vip: 'VIP', score: 'Score',
    visits: 'visits', lastVisit: 'Last visit', notes: 'Notes',
  },
  orders: {
    newOrder: 'New order', collecting: 'Taking order', confirmed: 'Confirmed', ready: 'Ready',
    delivering: 'Delivering', delivered: 'Delivered', pickup: 'Pickup', delivery: 'Delivery',
  },
  insights: {
    detected: 'Your AI detected', conversionUp: 'Conversion is up', conversionDown: 'Conversion dropped',
    peakHour: 'Peak hour right now', repeatCustomer: 'is a regular',
    learning: 'Your receptionist is learning', capacityHigh: 'Busy day ahead',
    noShowRisk: 'reservations might not show', newCustomers: 'new faces this week',
  },
  sms: {
    reservationConfirmed: 'your reservation is confirmed', reservationCancelled: 'your reservation has been cancelled',
    reminder: 'reminder: your reservation is tomorrow', orderConfirmed: 'your order is confirmed',
    orderReady: 'your order is ready',
  },
}

const FR: Translations = {
  locale: 'fr',
  common: {
    save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier', close: 'Fermer',
    loading: 'Chargement...', error: 'Erreur', success: 'Fait', confirm: 'Confirmer',
    search: 'Rechercher', export: 'Exporter', back: 'Retour', next: 'Suivant', all: 'Toutes',
    yes: 'Oui', no: 'Non', or: 'ou', and: 'et',
  },
  nav: {
    panel: 'Tableau de bord', reservations: 'Réservations', agenda: 'Agenda', calls: 'Appels',
    clients: 'Clients', spaces: 'Tables et zones', shifts: 'Horaires', products: 'Menu et produits',
    orders: 'Commandes', stats: 'Statistiques', billing: 'Facturation', agent: 'Mon réceptionniste', settings: 'Paramètres',
  },
  agent: {
    greeting: 'Bonjour, comment puis-je vous aider?', agentActive: 'actif', agentInactive: 'Pas de numéro assigné',
    callCompleted: 'Appel terminé', callMissed: 'Appel manqué', callInProgress: 'En cours',
  },
  reservations: {
    confirmed: 'Confirmée', pending: 'En attente', cancelled: 'Annulée', completed: 'Terminée', noShow: 'Absent',
    newReservation: 'Nouvelle réservation', noReservations: 'Aucune réservation', people: 'personnes', table: 'Table',
  },
  clients: {
    newClient: 'Nouveau client', noClients: 'Aucun client', vip: 'VIP', score: 'Score',
    visits: 'visites', lastVisit: 'Dernière visite', notes: 'Notes',
  },
  orders: {
    newOrder: 'Nouvelle commande', collecting: 'Prise de commande', confirmed: 'Confirmée', ready: 'Prête',
    delivering: 'En livraison', delivered: 'Livrée', pickup: 'À emporter', delivery: 'Livraison',
  },
  insights: {
    detected: 'Votre IA a détecté', conversionUp: 'La conversion monte', conversionDown: 'La conversion a baissé',
    peakHour: 'Heure de pointe', repeatCustomer: 'est un habitué',
    learning: 'Votre réceptionniste apprend', capacityHigh: 'Journée chargée',
    noShowRisk: 'réservations risquent de ne pas venir', newCustomers: 'nouveaux visages cette semaine',
  },
  sms: {
    reservationConfirmed: 'votre réservation est confirmée', reservationCancelled: 'votre réservation a été annulée',
    reminder: 'rappel: votre réservation est demain', orderConfirmed: 'votre commande est confirmée',
    orderReady: 'votre commande est prête',
  },
}

const PT: Translations = {
  locale: 'pt',
  common: {
    save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', edit: 'Editar', close: 'Fechar',
    loading: 'A carregar...', error: 'Erro', success: 'Feito', confirm: 'Confirmar',
    search: 'Pesquisar', export: 'Exportar', back: 'Voltar', next: 'Seguinte', all: 'Todas',
    yes: 'Sim', no: 'Não', or: 'ou', and: 'e',
  },
  nav: {
    panel: 'Painel', reservations: 'Reservas', agenda: 'Agenda', calls: 'Chamadas',
    clients: 'Clientes', spaces: 'Mesas e zonas', shifts: 'Turnos', products: 'Menu e produtos',
    orders: 'Pedidos', stats: 'Estatísticas', billing: 'Faturação', agent: 'Meu rececionista', settings: 'Configurações',
  },
  agent: {
    greeting: 'Olá, como posso ajudar?', agentActive: 'ativo', agentInactive: 'Sem número atribuído',
    callCompleted: 'Chamada concluída', callMissed: 'Chamada perdida', callInProgress: 'Em curso',
  },
  reservations: {
    confirmed: 'Confirmada', pending: 'Pendente', cancelled: 'Cancelada', completed: 'Concluída', noShow: 'Não compareceu',
    newReservation: 'Nova reserva', noReservations: 'Sem reservas', people: 'pessoas', table: 'Mesa',
  },
  clients: {
    newClient: 'Novo cliente', noClients: 'Sem clientes', vip: 'VIP', score: 'Pontuação',
    visits: 'visitas', lastVisit: 'Última visita', notes: 'Notas',
  },
  orders: {
    newOrder: 'Novo pedido', collecting: 'A anotar pedido', confirmed: 'Confirmado', ready: 'Pronto',
    delivering: 'Em entrega', delivered: 'Entregue', pickup: 'Levantar', delivery: 'Entrega',
  },
  insights: {
    detected: 'A sua IA detetou', conversionUp: 'A conversão está a subir', conversionDown: 'A conversão desceu',
    peakHour: 'Hora de ponta', repeatCustomer: 'é um habitual',
    learning: 'O seu rececionista está a aprender', capacityHigh: 'Dia movimentado',
    noShowRisk: 'reservas podem não comparecer', newCustomers: 'caras novas esta semana',
  },
  sms: {
    reservationConfirmed: 'a sua reserva está confirmada', reservationCancelled: 'a sua reserva foi cancelada',
    reminder: 'lembrete: a sua reserva é amanhã', orderConfirmed: 'o seu pedido está confirmado',
    orderReady: 'o seu pedido está pronto',
  },
}

const TRANSLATIONS: Record<Locale, Translations> = { es: ES, en: EN, fr: FR, pt: PT, ca: ES }

export function getTranslations(locale: string): Translations {
  return TRANSLATIONS[locale as Locale] || ES
}

/** Status labels for reservations — used across 16+ files */
export function getStatusLabel(status: string, locale: string = 'es'): string {
  const t = getTranslations(locale)
  const map: Record<string, string> = {
    confirmada: t.reservations.confirmed, confirmed: t.reservations.confirmed,
    pendiente: t.reservations.pending, pending: t.reservations.pending,
    cancelada: t.reservations.cancelled, cancelled: t.reservations.cancelled,
    completada: t.reservations.completed, completed: t.reservations.completed,
    no_show: t.reservations.noShow,
    // call statuses
    activa: t.agent.callInProgress, 'in-progress': t.agent.callInProgress,
    fallida: locale === 'es' ? 'Fallida' : locale === 'en' ? 'Failed' : locale === 'fr' ? 'Échoué' : locale === 'pt' ? 'Falhada' : 'Fallida',
    failed: locale === 'es' ? 'Fallida' : locale === 'en' ? 'Failed' : locale === 'fr' ? 'Échoué' : locale === 'pt' ? 'Falhada' : 'Fallida',
    'no-answer': t.agent.callMissed, perdida: t.agent.callMissed,
    // billing statuses
    paid: locale === 'es' ? 'Pagado' : locale === 'en' ? 'Paid' : locale === 'fr' ? 'Payé' : locale === 'pt' ? 'Pago' : 'Pagat',
    unpaid: locale === 'es' ? 'Pendiente' : locale === 'en' ? 'Unpaid' : locale === 'fr' ? 'Impayé' : locale === 'pt' ? 'Pendente' : 'Pendent',
    // ecom / order statuses
    nuevo: locale === 'es' ? 'Nuevo' : locale === 'en' ? 'New' : locale === 'fr' ? 'Nouveau' : locale === 'pt' ? 'Novo' : 'Nuevo',
    confirmado: t.orders.confirmed,
    enviado: locale === 'es' ? 'Enviado' : locale === 'en' ? 'Shipped' : locale === 'fr' ? 'Expédié' : locale === 'pt' ? 'Enviado' : 'Enviado',
    entregado: t.orders.delivered,
    cancelado: locale === 'es' ? 'Cancelado' : locale === 'en' ? 'Cancelled' : locale === 'fr' ? 'Annulé' : locale === 'pt' ? 'Cancelado' : 'Cancelado',
  }
  return map[status] || status
}

/**
 * Auto-translate any Spanish string. Covers 100+ common UI strings.
 * Usage: tx('Guardar cambios', 'en') → 'Save changes'
 */
const TX: Record<string, Record<string, string>> = {
  'Guardar': {en:'Save',fr:'Enregistrer',pt:'Guardar',ca:'Desar'},
  'Guardar cambios': {en:'Save changes',fr:'Enregistrer',pt:'Guardar alterações',ca:'Desar canvis'},
  'Guardando...': {en:'Saving...',fr:'Enregistrement...',pt:'A guardar...',ca:'Desant...'},
  'Cargando...': {en:'Loading...',fr:'Chargement...',pt:'A carregar...',ca:'Carregant...'},
  'Cancelar': {en:'Cancel',fr:'Annuler',pt:'Cancelar',ca:'Cancel·lar'},
  'Eliminar': {en:'Delete',fr:'Supprimer',pt:'Eliminar',ca:'Eliminar'},
  'Cerrar': {en:'Close',fr:'Fermer',pt:'Fechar',ca:'Tancar'},
  'Hoy': {en:'Today',fr:"Aujourd'hui",pt:'Hoje',ca:'Avui'},
  'ahora mismo': {en:'just now',fr:"à l'instant",pt:'agora mesmo',ca:'ara mateix'},
  'Llamadas recientes': {en:'Recent calls',fr:'Appels récents',pt:'Chamadas recentes',ca:'Trucades recents'},
  'Llamadas hoy': {en:'Calls today',fr:"Appels aujourd'hui",pt:'Chamadas hoje',ca:'Trucades avui'},
  'llamadas en total': {en:'total calls',fr:'appels au total',pt:'chamadas no total',ca:'trucades en total'},
  'Reservas hoy': {en:'Reservations today',fr:"Réservations aujourd'hui",pt:'Reservas hoje',ca:'Reserves avui'},
  'Llamadas restantes': {en:'Calls remaining',fr:'Appels restants',pt:'Chamadas restantes',ca:'Trucades restants'},
  'Uso del plan': {en:'Plan usage',fr:'Utilisation du plan',pt:'Uso do plano',ca:'Ús del pla'},
  'Ver todas →': {en:'View all →',fr:'Voir tout →',pt:'Ver todas →',ca:'Veure totes →'},
  'Gestionar →': {en:'Manage →',fr:'Gérer →',pt:'Gerir →',ca:'Gestionar →'},
  'Así pinta hoy': {en:"Today's forecast",fr:'Prévision du jour',pt:'Previsão de hoje',ca:'Previsió avui'},
  'Actividad en vivo': {en:'Live activity',fr:'Activité en direct',pt:'Atividade ao vivo',ca:'Activitat en viu'},
  'Todas': {en:'All',fr:'Toutes',pt:'Todas',ca:'Totes'},
  'Completadas': {en:'Completed',fr:'Terminées',pt:'Concluídas',ca:'Completades'},
  'Perdidas': {en:'Missed',fr:'Manqués',pt:'Perdidas',ca:'Perdudes'},
  'Fallidas': {en:'Failed',fr:'Échouées',pt:'Falhadas',ca:'Fallides'},
  'Sin llamadas aún': {en:'No calls yet',fr:"Pas d'appels",pt:'Sem chamadas',ca:'Sense trucades'},
  'Llamar de vuelta': {en:'Call back',fr:'Rappeler',pt:'Ligar de volta',ca:'Tornar a trucar'},
  'Llamar': {en:'Call',fr:'Appeler',pt:'Ligar',ca:'Trucar'},
  'Sin clientes': {en:'No clients',fr:'Pas de clients',pt:'Sem clientes',ca:'Sense clients'},
  'Sin actividad registrada.': {en:'No activity recorded.',fr:'Aucune activité.',pt:'Sem atividade.',ca:'Sense activitat.'},
  'Sin actividad registrada': {en:'No activity recorded',fr:'Aucune activité',pt:'Sem atividade',ca:'Sense activitat'},
  'Notas': {en:'Notes',fr:'Notes',pt:'Notas',ca:'Notes'},
  'Historial': {en:'History',fr:'Historique',pt:'Histórico',ca:'Historial'},
  'Nueva reserva': {en:'New reservation',fr:'Nouvelle réservation',pt:'Nova reserva',ca:'Nova reserva'},
  'Sin reservas este día': {en:'No reservations this day',fr:'Pas de réservations ce jour',pt:'Sem reservas neste dia',ca:'Sense reserves avui'},
  'personas': {en:'people',fr:'personnes',pt:'pessoas',ca:'persones'},
  'Nuevo pedido': {en:'New order',fr:'Nouvelle commande',pt:'Novo pedido',ca:'Nova comanda'},
  'Para recoger': {en:'Pickup',fr:'À emporter',pt:'Para levantar',ca:'Per recollir'},
  'A domicilio': {en:'Delivery',fr:'Livraison',pt:'Entrega',ca:'A domicili'},
  'Configurar →': {en:'Configure →',fr:'Configurer →',pt:'Configurar →',ca:'Configurar →'},
  'Horarios y capacidad': {en:'Hours & capacity',fr:'Horaires et capacité',pt:'Horários e capacidade',ca:'Horaris i capacitat'},
  'Resumen': {en:'Summary',fr:'Résumé',pt:'Resumo',ca:'Resum'},
  'Sin resumen': {en:'No summary',fr:'Pas de résumé',pt:'Sem resumo',ca:'Sense resum'},
  'Número oculto': {en:'Hidden number',fr:'Numéro masqué',pt:'Número oculto',ca:'Número ocult'},
  'Sin contacto': {en:'No contact',fr:'Pas de contact',pt:'Sem contacto',ca:'Sense contacte'},
  'confirmadas': {en:'confirmed',fr:'confirmées',pt:'confirmadas',ca:'confirmades'},
  'Control de turnos': {en:'Shift control',fr:'Contrôle des horaires',pt:'Controlo de turnos',ca:'Control de torns'},
  'Capacidad por franja': {en:'Capacity per slot',fr:'Capacité par créneau',pt:'Capacidade por faixa',ca:'Capacitat per franja'},
  'Plano del local': {en:'Floor plan',fr:'Plan du local',pt:'Plano do local',ca:'Plànol del local'},
  'Reserva creada por el agente de voz': {en:'Reservation created by voice agent',fr:"Réservation créée par l'agent vocal",pt:'Reserva criada pelo agente de voz',ca:'Reserva creada per agent de veu'},
  'Comportamiento del agente': {en:'Agent behavior',fr:"Comportement de l'agent",pt:'Comportamento do agente',ca:"Comportament de l'agent"},
  'Reglas': {en:'Rules',fr:'Règles',pt:'Regras',ca:'Regles'},
  'Base de conocimiento': {en:'Knowledge base',fr:'Base de connaissances',pt:'Base de conhecimento',ca:'Base de coneixement'},
  'Memoria aprendida': {en:'Learned memory',fr:'Mémoire apprise',pt:'Memória aprendida',ca:'Memòria apresa'},
  'Activar →': {en:'Activate →',fr:'Activer →',pt:'Ativar →',ca:'Activar →'},
  'Tu recepcionista está activa': {en:'Your receptionist is active',fr:'Votre réceptionniste est actif',pt:'O rececionista está ativo',ca:'La recepcionista és activa'},
  'Esperando llamadas': {en:'Waiting for calls',fr:'En attente d\'appels',pt:'À espera de chamadas',ca:'Esperant trucades'},
  'en vivo': {en:'live',fr:'en direct',pt:'ao vivo',ca:'en viu'},
  'Acción': {en:'Action',fr:'Action',pt:'Ação',ca:'Acció'},
  'Lo que hizo': {en:'What it did',fr:"Ce qu'il a fait",pt:'O que fez',ca:'El que va fer'},
  'Esto no es correcto, quiero cambiarlo': {en:'This is wrong, I want to change it',fr:'Ce n\'est pas correct, je veux le changer',pt:'Isto não está correto, quero mudar',ca:'Això no és correcte, vull canviar-ho'},
  // Sidebar
  'Cerrar sesión': {en:'Sign out',fr:'Déconnexion',pt:'Terminar sessão',ca:'Tancar sessió'},
  'Llamadas este mes': {en:'Calls this month',fr:'Appels ce mois',pt:'Chamadas este mês',ca:'Trucades aquest mes'},
  'Prueba': {en:'Trial',fr:'Essai',pt:'Teste',ca:'Prova'},
  'Básico': {en:'Basic',fr:'Basique',pt:'Básico',ca:'Bàsic'},
  'Profesional': {en:'Professional',fr:'Professionnel',pt:'Profissional',ca:'Professional'},
  'Completo': {en:'Complete',fr:'Complet',pt:'Completo',ca:'Complet'},
  // Estadisticas
  'Reservas este mes': {en:'Reservations this month',fr:'Réservations ce mois',pt:'Reservas este mês',ca:'Reserves aquest mes'},
  'Tasa conversión': {en:'Conversion rate',fr:'Taux de conversion',pt:'Taxa de conversão',ca:'Taxa de conversió'},
  'Clientes': {en:'Clients',fr:'Clients',pt:'Clientes',ca:'Clients'},
  'Reservas por día de la semana': {en:'Reservations by day of week',fr:'Réservations par jour',pt:'Reservas por dia da semana',ca:'Reserves per dia'},
  'Hora pico': {en:'Peak hour',fr:'Heure de pointe',pt:'Hora de pico',ca:'Hora punta'},
  'Origen reservas': {en:'Reservation source',fr:'Source des réservations',pt:'Origem das reservas',ca:'Origen reserves'},
  'Via agente voz': {en:'Via voice agent',fr:'Via agent vocal',pt:'Via agente de voz',ca:'Via agent de veu'},
  'Manuales': {en:'Manual',fr:'Manuelles',pt:'Manuais',ca:'Manuals'},
  'Intenciones detectadas': {en:'Detected intents',fr:'Intentions détectées',pt:'Intenções detetadas',ca:'Intencions detectades'},
  'Rendimiento de tu recepcionista y reservas': {en:'Your receptionist performance and reservations',fr:'Performance de votre réceptionniste',pt:'Desempenho do rececionista e reservas',ca:'Rendiment de la recepcionista'},
  // Facturacion
  'Control en tiempo real de tu plan y consumo': {en:'Real-time plan and usage control',fr:'Contrôle en temps réel',pt:'Controlo em tempo real do plano',ca:'Control en temps real del pla'},
  'Plan actual': {en:'Current plan',fr:'Plan actuel',pt:'Plano atual',ca:'Pla actual'},
  'Llamadas usadas': {en:'Calls used',fr:'Appels utilisés',pt:'Chamadas usadas',ca:'Trucades usades'},
  'Incluidas': {en:'Included',fr:'Incluses',pt:'Incluídas',ca:'Incloses'},
  'Extra': {en:'Extra',fr:'Extra',pt:'Extra',ca:'Extra'},
  'Coste extra estimado': {en:'Estimated extra cost',fr:'Coût supplémentaire estimé',pt:'Custo extra estimado',ca:'Cost extra estimat'},
  'Total estimado': {en:'Estimated total',fr:'Total estimé',pt:'Total estimado',ca:'Total estimat'},
  'Renovación': {en:'Renewal',fr:'Renouvellement',pt:'Renovação',ca:'Renovació'},
  'Elige tu plan': {en:'Choose your plan',fr:'Choisissez votre plan',pt:'Escolha o seu plano',ca:'Tria el teu pla'},
  'Pagado': {en:'Paid',fr:'Payé',pt:'Pago',ca:'Pagat'},
  'Historial de facturación': {en:'Billing history',fr:'Historique de facturation',pt:'Histórico de faturação',ca:'Historial de facturació'},
  // Config
  'Cómo trabaja tu recepcionista': {en:'How your receptionist works',fr:'Comment fonctionne votre réceptionniste',pt:'Como funciona o rececionista',ca:'Com treballa la recepcionista'},
  'Aquí decides todo': {en:'You decide everything here',fr:'Vous décidez de tout ici',pt:'Aqui decides tudo',ca:'Aquí ho decideixes tot'},
  // Common
  'Buenos días': {en:'Good morning',fr:'Bonjour',pt:'Bom dia',ca:'Bon dia'},
  'Buenas tardes': {en:'Good afternoon',fr:'Bon après-midi',pt:'Boa tarde',ca:'Bona tarda'},
  'Buenas noches': {en:'Good evening',fr:'Bonsoir',pt:'Boa noite',ca:'Bona nit'},
  'confirmada': {en:'confirmed',fr:'confirmée',pt:'confirmada',ca:'confirmada'},
  'Cargar más llamadas': {en:'Load more calls',fr:'Charger plus',pt:'Carregar mais',ca:'Carregar més'},
  // Config page — basic
  'Guardado': {en:'Saved',fr:'Enregistré',pt:'Guardado',ca:'Desat'},
  'Enséñale cómo funciona tu negocio y cómo quieres que actúe': {en:'Teach it how your business works and how you want it to act',fr:'Apprenez-lui comment fonctionne votre entreprise',pt:'Ensine como funciona o seu negócio e como quer que atue',ca:'Ensenya-li com funciona el teu negoci'},
  'CONFIGURACIÓN BÁSICA': {en:'BASIC SETTINGS',fr:'CONFIGURATION DE BASE',pt:'CONFIGURAÇÃO BÁSICA',ca:'CONFIGURACIÓ BÀSICA'},
  'NOMBRE DEL NEGOCIO': {en:'BUSINESS NAME',fr:"NOM DE L'ÉTABLISSEMENT",pt:'NOME DO NEGÓCIO',ca:'NOM DEL NEGOCI'},
  'Mi negocio': {en:'My business',fr:'Mon établissement',pt:'Meu negócio',ca:'El meu negoci'},
  'NOMBRE DEL AGENTE': {en:'AGENT NAME',fr:"NOM DE L'AGENT",pt:'NOME DO AGENTE',ca:"NOM DE L'AGENT"},
  'NÚMERO DE TELÉFONO DEL AGENTE': {en:'AGENT PHONE NUMBER',fr:"NUMÉRO DE TÉLÉPHONE DE L'AGENT",pt:'NÚMERO DE TELEFONE DO AGENTE',ca:"NÚMERO DE TELÈFON DE L'AGENT"},
  'NÚMERO DE TRANSFERENCIA': {en:'TRANSFER NUMBER',fr:'NUMÉRO DE TRANSFERT',pt:'NÚMERO DE TRANSFERÊNCIA',ca:'NÚMERO DE TRANSFERÈNCIA'},
  'Cuando tu recepcionista no pueda resolver, transferirá la llamada a este número': {en:'When your receptionist can\'t resolve, calls are transferred to this number',fr:'Quand le réceptionniste ne peut pas résoudre, l\'appel est transféré à ce numéro',pt:'Quando o rececionista não conseguir resolver, transfere a chamada para este número',ca:'Quan la recepcionista no pugui resoldre, transferirà la trucada a aquest número'},
  'IDIOMA DEL PANEL': {en:'PANEL LANGUAGE',fr:'LANGUE DU PANNEAU',pt:'IDIOMA DO PAINEL',ca:'IDIOMA DEL PANELL'},
  'Cambia el idioma de todo el panel de control': {en:'Change the language of the entire control panel',fr:'Changer la langue de tout le panneau de contrôle',pt:'Muda o idioma de todo o painel de controlo',ca:'Canvia l\'idioma de tot el panell de control'},
  // Config page — scheduling
  'Configura cuándo atiendes y cuánta gente puedes recibir': {en:'Set when you\'re open and how many people you can serve',fr:'Configurez quand vous êtes ouvert et votre capacité',pt:'Configure quando atende e quantas pessoas pode receber',ca:'Configura quan ateens i quanta gent pots rebre'},
  'Horario de apertura': {en:'Opening hours',fr:"Horaires d'ouverture",pt:'Horário de abertura',ca:"Horari d'obertura"},
  'Comidas': {en:'Lunch',fr:'Déjeuner',pt:'Almoços',ca:'Dinars'},
  'Cenas': {en:'Dinner',fr:'Dîner',pt:'Jantares',ca:'Sopars'},
  'Apertura': {en:'Opening',fr:'Ouverture',pt:'Abertura',ca:'Obertura'},
  'Cierre': {en:'Closing',fr:'Fermeture',pt:'Fecho',ca:'Tancament'},
  'Días que abres': {en:'Days you\'re open',fr:'Jours d\'ouverture',pt:'Dias que abre',ca:'Dies que obres'},
  'Pulsa un día para cerrarlo. Los días activos aparecen en color.': {en:'Tap a day to close it. Active days are shown in color.',fr:'Appuyez sur un jour pour le fermer. Les jours actifs sont en couleur.',pt:'Toque num dia para fechá-lo. Os dias ativos aparecem a cores.',ca:'Prem un dia per tancar-lo. Els dies actius apareixen en color.'},
  'Máximo de reservas por franja': {en:'Max reservations per slot',fr:'Réservations max par créneau',pt:'Máximo de reservas por faixa',ca:'Màxim de reserves per franja'},
  'Cuántas reservas/citas puedes atender a la vez': {en:'How many reservations/appointments you can handle at once',fr:'Combien de réservations vous pouvez gérer à la fois',pt:'Quantas reservas/consultas pode atender ao mesmo tempo',ca:'Quantes reserves/cites pots atendre alhora'},
  'Máximo de personas por franja': {en:'Max people per slot',fr:'Personnes max par créneau',pt:'Máximo de pessoas por faixa',ca:'Màxim de persones per franja'},
  'Total de personas que caben en una misma franja horaria': {en:'Total people that fit in a single time slot',fr:'Nombre total de personnes par créneau horaire',pt:'Total de pessoas que cabem na mesma faixa horária',ca:'Total de persones que caben en una mateixa franja horària'},
  'Duración y tiempos': {en:'Duration & timing',fr:'Durée et horaires',pt:'Duração e tempos',ca:'Durada i temps'},
  'Duración media de cada reserva/cita': {en:'Average duration per reservation/appointment',fr:'Durée moyenne par réservation/rendez-vous',pt:'Duração média de cada reserva/consulta',ca:'Durada mitjana de cada reserva/cita'},
  'Cuánto dura normalmente una visita o servicio': {en:'How long a visit or service usually takes',fr:'Combien dure normalement une visite ou un service',pt:'Quanto dura normalmente uma visita ou serviço',ca:'Quant dura normalment una visita o servei'},
  'Tiempo entre reservas (descanso)': {en:'Time between reservations (break)',fr:'Temps entre réservations (pause)',pt:'Tempo entre reservas (descanso)',ca:'Temps entre reserves (descans)'},
  'Minutos de margen entre una reserva y la siguiente': {en:'Minutes of buffer between one reservation and the next',fr:'Minutes de marge entre une réservation et la suivante',pt:'Minutos de margem entre uma reserva e a seguinte',ca:'Minuts de marge entre una reserva i la següent'},
  'Sin pausa': {en:'No break',fr:'Sans pause',pt:'Sem pausa',ca:'Sense pausa'},
  'Intervalo de franjas': {en:'Slot interval',fr:'Intervalle des créneaux',pt:'Intervalo de faixas',ca:'Interval de franges'},
  'Cada cuántos minutos se puede reservar (ej: 13:00, 13:30, 14:00...)': {en:'How often slots are available (e.g. 13:00, 13:30, 14:00...)',fr:'À quelle fréquence les créneaux sont disponibles (ex: 13:00, 13:30...)',pt:'A cada quantos minutos se pode reservar (ex: 13:00, 13:30, 14:00...)',ca:'Cada quants minuts es pot reservar (ex: 13:00, 13:30, 14:00...)'},
  'Cada': {en:'Every',fr:'Chaque',pt:'Cada',ca:'Cada'},
  'Resumen de tu configuración': {en:'Your configuration summary',fr:'Résumé de votre configuration',pt:'Resumo da sua configuração',ca:'Resum de la teva configuració'},
  'Comidas de': {en:'Lunch from',fr:'Déjeuner de',pt:'Almoços de',ca:'Dinars de'},
  'a': {en:'to',fr:'à',pt:'a',ca:'a'},
  'Cenas de': {en:'Dinner from',fr:'Dîner de',pt:'Jantares de',ca:'Sopars de'},
  'Abierto de': {en:'Open from',fr:'Ouvert de',pt:'Aberto de',ca:'Obert de'},
  'Hasta': {en:'Up to',fr:"Jusqu'à",pt:'Até',ca:'Fins a'},
  'reservas y': {en:'reservations and',fr:'réservations et',pt:'reservas e',ca:'reserves i'},
  'personas por franja': {en:'people per slot',fr:'personnes par créneau',pt:'pessoas por faixa',ca:'persones per franja'},
  'por reserva': {en:'per reservation',fr:'par réservation',pt:'por reserva',ca:'per reserva'},
  'de descanso': {en:'break',fr:'de pause',pt:'de descanso',ca:'de descans'},
  // Config page — automation
  '¿Qué puede hacer sin preguntarte?': {en:'What can it do without asking you?',fr:'Que peut-il faire sans vous demander?',pt:'O que pode fazer sem perguntar?',ca:'Què pot fer sense preguntar-te?'},
  'Decide en qué situaciones': {en:'Decide in which situations',fr:'Décidez dans quelles situations',pt:'Decide em que situações',ca:'Decideix en quines situacions'},
  'puede actuar sola': {en:'can act on its own',fr:'peut agir seul',pt:'pode atuar sozinho',ca:'pot actuar sola'},
  '¿Puede confirmar reservas pequeñas sin avisarte?': {en:'Can it confirm small reservations without notifying you?',fr:'Peut-il confirmer les petites réservations sans vous prévenir?',pt:'Pode confirmar reservas pequenas sem avisar?',ca:'Pot confirmar reserves petites sense avisar-te?'},
  'confirma directamente cuando la reserva entra dentro de lo normal': {en:'confirms directly when the reservation is within normal parameters',fr:'confirme directement quand la réservation est dans la norme',pt:'confirma diretamente quando a reserva é normal',ca:'confirma directament quan la reserva és normal'},
  '¿Puede gestionar cancelaciones sin consultarte?': {en:'Can it handle cancellations without asking you?',fr:'Peut-il gérer les annulations sans vous consulter?',pt:'Pode gerir cancelamentos sem consultar?',ca:'Pot gestionar cancel·lacions sense consultar-te?'},
  'Si un cliente cancela,': {en:'If a client cancels,',fr:'Si un client annule,',pt:'Se um cliente cancela,',ca:'Si un client cancel·la,'},
  'lo anota sin necesidad de avisarte': {en:'it records it without needing to notify you',fr:'il le note sans avoir besoin de vous prévenir',pt:'anota sem necessidade de avisar',ca:'ho anota sense necessitat d\'avisar-te'},
  '¿Puede contestar preguntas de horarios y precios?': {en:'Can it answer questions about hours and prices?',fr:'Peut-il répondre aux questions sur les horaires et les prix?',pt:'Pode responder a perguntas sobre horários e preços?',ca:'Pot contestar preguntes d\'horaris i preus?'},
  'Horario, precios, servicios —': {en:'Hours, prices, services —',fr:'Horaires, prix, services —',pt:'Horário, preços, serviços —',ca:'Horari, preus, serveis —'},
  'responde directamente sin molestarte': {en:'answers directly without bothering you',fr:'répond directement sans vous déranger',pt:'responde diretamente sem incomodar',ca:'respon directament sense molestar-te'},
  '¿Hasta cuántas personas puede aceptar sola?': {en:'Up to how many people can it accept alone?',fr:'Jusqu\'à combien de personnes peut-il accepter seul?',pt:'Até quantas pessoas pode aceitar sozinho?',ca:'Fins a quantes persones pot acceptar sola?'},
  'Si el grupo es más grande que esto,': {en:'If the group is bigger than this,',fr:'Si le groupe est plus grand que ça,',pt:'Se o grupo for maior que isto,',ca:'Si el grup és més gran que això,'},
  'te avisa para que decidas tú': {en:'it alerts you so you can decide',fr:'il vous prévient pour que vous décidiez',pt:'avisa para que decida',ca:'t\'avisa perquè decideixis tu'},
  'Grupos de hasta': {en:'Groups up to',fr:"Groupes jusqu'à",pt:'Grupos até',ca:'Grups fins a'},
  'confirma sola.': {en:'confirms on its own.',fr:'confirme seul.',pt:'confirma sozinho.',ca:'confirma sola.'},
  'te avisa a ti.': {en:'alerts you.',fr:'vous prévient.',pt:'avisa-te.',ca:'t\'avisa a tu.'},
  // Config page — review
  '¿Cuándo quieres que te consulte?': {en:'When should it check with you?',fr:'Quand voulez-vous qu\'il vous consulte?',pt:'Quando quer que consulte?',ca:'Quan vols que et consulti?'},
  'En estas situaciones siempre te pregunta antes de confirmar': {en:'In these situations it always asks you before confirming',fr:'Dans ces situations il vous demande toujours avant de confirmer',pt:'Nestas situações pergunta sempre antes de confirmar',ca:'En aquestes situacions sempre et pregunta abans de confirmar'},
  'Si viene un grupo grande': {en:'If a large group comes',fr:'Si un grand groupe vient',pt:'Se vier um grupo grande',ca:'Si ve un grup gran'},
  'personas — te avisa siempre': {en:'people — always alerts you',fr:'personnes — vous prévient toujours',pt:'pessoas — avisa sempre',ca:'persones — t\'avisa sempre'},
  'Si piden algo especial, ¿te avisa?': {en:'If they request something special, does it alert you?',fr:'S\'ils demandent quelque chose de spécial, vous prévient-il?',pt:'Se pedirem algo especial, avisa?',ca:'Si demanen alguna cosa especial, t\'avisa?'},
  'El cliente pide algo fuera de lo habitual (mesa concreta, decoración, etc.)': {en:'The client requests something unusual (specific table, decoration, etc.)',fr:'Le client demande quelque chose d\'inhabituel (table spécifique, décoration, etc.)',pt:'O cliente pede algo fora do habitual (mesa específica, decoração, etc.)',ca:'El client demana alguna cosa fora de l\'habitual (taula concreta, decoració, etc.)'},
  'Si mencionan alergias o intolerancias': {en:'If they mention allergies or intolerances',fr:'S\'ils mentionnent des allergies ou intolérances',pt:'Se mencionarem alergias ou intolerâncias',ca:'Si mencionen al·lèrgies o intoleràncies'},
  'Te avisa para que lo tengas en cuenta y lo prepares': {en:'Alerts you so you can take it into account and prepare',fr:'Vous prévient pour que vous en teniez compte',pt:'Avisa para ter em conta e preparar',ca:'T\'avisa perquè ho tinguis en compte i ho prepareu'},
  'Si quieren reservar en horarios raros': {en:'If they want to book at unusual hours',fr:'S\'ils veulent réserver à des heures inhabituelles',pt:'Se quiserem reservar em horários incomuns',ca:'Si volen reservar en horaris estranys'},
  'Reservas muy fuera de tu hora punta': {en:'Reservations well outside your peak hours',fr:'Réservations en dehors de vos heures de pointe',pt:'Reservas muito fora da hora de pico',ca:'Reserves molt fora de la teva hora punta'},
  'Si es alguien que llama por primera vez': {en:'If it\'s someone calling for the first time',fr:'Si c\'est quelqu\'un qui appelle pour la première fois',pt:'Se for alguém que liga pela primeira vez',ca:'Si és algú que truca per primera vegada'},
  'Primera llamada de ese número — te avisa para que lo atiendas tú si quieres': {en:'First call from that number — alerts you in case you want to handle it yourself',fr:'Premier appel de ce numéro — vous prévient au cas où',pt:'Primeira chamada desse número — avisa para que atenda se quiser',ca:'Primera trucada d\'aquest número — t\'avisa per si el vols atendre tu'},
  // Config page — rejection
  '¿Cuándo tiene que decir que no?': {en:'When should it say no?',fr:'Quand doit-il dire non?',pt:'Quando tem de dizer que não?',ca:'Quan ha de dir que no?'},
  'rechazará educadamente en estas situaciones': {en:'will politely decline in these situations',fr:'refusera poliment dans ces situations',pt:'recusará educadamente nestas situações',ca:'rebutjarà educadament en aquestes situacions'},
  'Cuando estáis cerrados': {en:'When you\'re closed',fr:'Quand vous êtes fermé',pt:'Quando estão fechados',ca:'Quan esteu tancats'},
  'Si llaman fuera de horario,': {en:'If they call outside hours,',fr:'S\'ils appellent hors horaires,',pt:'Se ligarem fora de horário,',ca:'Si truquen fora d\'horari,'},
  'les informa y les pide que llamen cuando estéis abiertos': {en:'informs them and asks them to call when you\'re open',fr:'les informe et leur demande de rappeler quand vous êtes ouvert',pt:'informa e pede que liguem quando estiverem abertos',ca:'els informa i els demana que truquin quan estigueu oberts'},
  'Cuando no hay sitio': {en:'When there\'s no availability',fr:'Quand il n\'y a pas de place',pt:'Quando não há lugar',ca:'Quan no hi ha lloc'},
  'Si no queda disponibilidad,': {en:'If there\'s no availability,',fr:'S\'il n\'y a pas de disponibilité,',pt:'Se não houver disponibilidade,',ca:'Si no queda disponibilitat,'},
  'lo dice claramente y ofrece alternativas': {en:'says so clearly and offers alternatives',fr:'le dit clairement et propose des alternatives',pt:'diz claramente e oferece alternativas',ca:'ho diu clarament i ofereix alternatives'},
  'Si piden algo que no ofrecéis': {en:'If they ask for something you don\'t offer',fr:'S\'ils demandent quelque chose que vous ne proposez pas',pt:'Se pedirem algo que não oferecem',ca:'Si demanen alguna cosa que no oferiu'},
  'responde que ese servicio no está disponible en vuestro negocio': {en:'responds that this service is not available at your business',fr:'répond que ce service n\'est pas disponible',pt:'responde que esse serviço não está disponível',ca:'respon que aquest servei no està disponible'},
  // Config page — alternatives
  '¿Qué ofrece cuando no puede?': {en:'What does it offer when it can\'t?',fr:'Que propose-t-il quand il ne peut pas?',pt:'O que oferece quando não pode?',ca:'Què ofereix quan no pot?'},
  'Si no hay sitio en el horario pedido,': {en:'If there\'s no availability at the requested time,',fr:'S\'il n\'y a pas de place à l\'heure demandée,',pt:'Se não houver lugar no horário pedido,',ca:'Si no hi ha lloc a l\'horari demanat,'},
  'hará esto': {en:'will do this',fr:'fera ceci',pt:'fará isto',ca:'farà això'},
  'Proponer otro horario disponible': {en:'Suggest another available time',fr:'Proposer un autre horaire disponible',pt:'Propor outro horário disponível',ca:'Proposar un altre horari disponible'},
  'busca la siguiente hora libre y se la ofrece al cliente': {en:'finds the next free slot and offers it to the client',fr:'cherche le prochain créneau libre et le propose au client',pt:'procura a próxima hora livre e oferece ao cliente',ca:'busca la següent hora lliure i l\'ofereix al client'},
  'Dejar la solicitud anotada': {en:'Leave the request noted',fr:'Laisser la demande notée',pt:'Deixar o pedido anotado',ca:'Deixar la sol·licitud anotada'},
  'Si el cliente prefiere esperar, queda guardada para que tú la gestiones': {en:'If the client prefers to wait, it\'s saved for you to manage',fr:'Si le client préfère attendre, la demande est enregistrée',pt:'Se o cliente preferir esperar, fica guardado para gerir',ca:'Si el client prefereix esperar, queda guardada perquè la gestionis'},
  'Apuntar en lista de espera': {en:'Add to waitlist',fr:'Ajouter à la liste d\'attente',pt:'Adicionar à lista de espera',ca:'Apuntar a llista d\'espera'},
  'ofrece avisar al cliente si se libera un hueco': {en:'offers to notify the client if a spot opens up',fr:'propose de prévenir le client si une place se libère',pt:'oferece avisar o cliente se abrir uma vaga',ca:'ofereix avisar el client si s\'allibera un lloc'},
  '¿Cuántas opciones le ofrece como mucho?': {en:'How many options does it offer at most?',fr:'Combien d\'options propose-t-il au maximum?',pt:'Quantas opções oferece no máximo?',ca:'Quantes opcions li ofereix com a màxim?'},
  'no propone más alternativas que este número para no agobiar al cliente': {en:'won\'t suggest more alternatives than this to avoid overwhelming the client',fr:'ne propose pas plus d\'alternatives que ce nombre',pt:'não propõe mais alternativas que este número para não sobrecarregar',ca:'no proposa més alternatives que aquest número per no aclaparar el client'},
  // Config page — knowledge
  '¿Qué sabe de tu negocio?': {en:'What does it know about your business?',fr:'Que sait-il de votre entreprise?',pt:'O que sabe do seu negócio?',ca:'Què sap del teu negoci?'},
  'Cuéntale a': {en:'Tell',fr:'Dites à',pt:'Conte ao',ca:'Explica-li a'},
  'todo lo que necesita para responder bien': {en:'everything it needs to respond well',fr:'tout ce dont il a besoin pour bien répondre',pt:'tudo o que precisa para responder bem',ca:'tot el que necessita per respondre bé'},
  'Horarios': {en:'Hours',fr:'Horaires',pt:'Horários',ca:'Horaris'},
  'Cuándo abrís y cuándo cerráis. Escríbelo como lo dirías por teléfono.': {en:'When you open and close. Write it as you\'d say it on the phone.',fr:'Quand vous ouvrez et fermez. Écrivez-le comme vous le diriez au téléphone.',pt:'Quando abrem e quando fecham. Escreva como diria ao telefone.',ca:'Quan obriu i quan tanqueu. Escriu-ho com ho diries per telèfon.'},
  'líneas': {en:'lines',fr:'lignes',pt:'linhas',ca:'línies'},
  'Carta / Menú': {en:'Menu',fr:'Carte / Menu',pt:'Carta / Menu',ca:'Carta / Menú'},
  'Escribe los platos y precios.': {en:'Write the dishes and prices.',fr:'Écrivez les plats et les prix.',pt:'Escreva os pratos e preços.',ca:'Escriu els plats i preus.'},
  'se lo aprenderá de memoria.': {en:'will memorize it.',fr:'le mémorisera.',pt:'memorizará.',ca:'s\'ho aprendrà de memòria.'},
  'Otros servicios y precios': {en:'Other services & prices',fr:'Autres services et prix',pt:'Outros serviços e preços',ca:'Altres serveis i preus'},
  'Tus servicios y precios': {en:'Your services & prices',fr:'Vos services et prix',pt:'Os seus serviços e preços',ca:'Els teus serveis i preus'},
  'Escribe qué ofreces y cuánto cuesta.': {en:'Write what you offer and how much it costs.',fr:'Écrivez ce que vous proposez et combien ça coûte.',pt:'Escreva o que oferece e quanto custa.',ca:'Escriu què ofereixes i quant costa.'},
  'lo usará cuando los clientes pregunten.': {en:'will use it when clients ask.',fr:'l\'utilisera quand les clients demanderont.',pt:'usará quando os clientes perguntarem.',ca:'ho farà servir quan els clients preguntin.'},
  'Condiciones y normas': {en:'Terms & policies',fr:'Conditions et règles',pt:'Condições e normas',ca:'Condicions i normes'},
  'Política de cancelaciones, reserva mínima, señal, etc.': {en:'Cancellation policy, minimum booking, deposit, etc.',fr:'Politique d\'annulation, réservation minimum, acompte, etc.',pt:'Política de cancelamento, reserva mínima, sinal, etc.',ca:'Política de cancel·lació, reserva mínima, senyal, etc.'},
  'Preguntas que te hacen siempre': {en:'Questions you always get asked',fr:'Questions fréquentes',pt:'Perguntas que fazem sempre',ca:'Preguntes que et fan sempre'},
  'Escribe las preguntas más frecuentes y sus respuestas': {en:'Write the most frequent questions and their answers',fr:'Écrivez les questions les plus fréquentes et leurs réponses',pt:'Escreva as perguntas mais frequentes e respostas',ca:'Escriu les preguntes més freqüents i les respostes'},
  'Por qué es importante': {en:'Why it matters',fr:'Pourquoi c\'est important',pt:'Porque é importante',ca:'Per què és important'},
  'Cuanto más le cuentes a': {en:'The more you tell',fr:'Plus vous en dites à',pt:'Quanto mais contar ao',ca:'Com més li expliquis a'},
  ', mejor responderá. Piensa en': {en:', the better it responds. Think of',fr:', mieux il répondra. Pensez à',pt:', melhor responderá. Pense no',ca:', millor respondrà. Pensa en'},
  'como una empleada nueva: necesita conocer tu negocio para atender bien.': {en:'as a new employee: it needs to know your business to serve well.',fr:'comme un nouvel employé: il doit connaître votre entreprise.',pt:'como uma empregada nova: precisa conhecer o seu negócio.',ca:'com una empleada nova: necessita conèixer el teu negoci.'},
  // Config page — flow
  '¿En qué orden pregunta?': {en:'In what order does it ask?',fr:'Dans quel ordre pose-t-il les questions?',pt:'Em que ordem pergunta?',ca:'En quin ordre pregunta?'},
  'El orden en que': {en:'The order in which',fr:'L\'ordre dans lequel',pt:'A ordem em que',ca:'L\'ordre en què'},
  'pide los datos al cliente cuando gestiona una solicitud': {en:'asks the client for details when handling a request',fr:'demande les informations au client lors d\'une demande',pt:'pede os dados ao cliente quando gere um pedido',ca:'demana les dades al client quan gestiona una sol·licitud'},
  'El agente seguirá este orden al gestionar una solicitud. Arrastra para reordenar. Pulsa para activar/desactivar.': {en:'The agent will follow this order when handling a request. Drag to reorder. Tap to enable/disable.',fr:'L\'agent suivra cet ordre. Glissez pour réorganiser. Appuyez pour activer/désactiver.',pt:'O agente seguirá esta ordem ao gerir um pedido. Arraste para reordenar.',ca:'L\'agent seguirà aquest ordre. Arrossega per reordenar. Prem per activar/desactivar.'},
  'Flujo actual': {en:'Current flow',fr:'Flux actuel',pt:'Fluxo atual',ca:'Flux actual'},
  // Config page — special cases
  'Situaciones especiales': {en:'Special situations',fr:'Situations spéciales',pt:'Situações especiais',ca:'Situacions especials'},
  'Dile a': {en:'Tell',fr:'Dites à',pt:'Diga ao',ca:'Digues-li a'},
  'exactamente qué hacer en estos casos': {en:'exactly what to do in these cases',fr:'exactement quoi faire dans ces cas',pt:'exatamente o que fazer nestes casos',ca:'exactament què fer en aquests casos'},
  'El cliente menciona alergias': {en:'Client mentions allergies',fr:'Le client mentionne des allergies',pt:'O cliente menciona alergias',ca:'El client menciona al·lèrgies'},
  'Alergias, intolerancias, restricciones alimentarias': {en:'Allergies, intolerances, dietary restrictions',fr:'Allergies, intolérances, restrictions alimentaires',pt:'Alergias, intolerâncias, restrições alimentares',ca:'Al·lèrgies, intoleràncies, restriccions alimentàries'},
  'Es para una celebración': {en:'It\'s for a celebration',fr:'C\'est pour une célébration',pt:'É para uma celebração',ca:'És per a una celebració'},
  'Cumpleaños, aniversarios, eventos especiales': {en:'Birthdays, anniversaries, special events',fr:'Anniversaires, événements spéciaux',pt:'Aniversários, eventos especiais',ca:'Aniversaris, esdeveniments especials'},
  'Es un grupo o evento': {en:'It\'s a group or event',fr:'C\'est un groupe ou événement',pt:'É um grupo ou evento',ca:'És un grup o esdeveniment'},
  'Cenas de empresa, fiestas, grupos numerosos': {en:'Corporate dinners, parties, large groups',fr:'Dîners d\'entreprise, fêtes, grands groupes',pt:'Jantares de empresa, festas, grupos grandes',ca:'Sopars d\'empresa, festes, grups nombrosos'},
  'Es un cliente muy fiel': {en:'It\'s a very loyal client',fr:'C\'est un client très fidèle',pt:'É um cliente muito fiel',ca:'És un client molt fidel'},
  'Clientes que llaman con mucha frecuencia': {en:'Clients who call very frequently',fr:'Clients qui appellent très fréquemment',pt:'Clientes que ligam com muita frequência',ca:'Clients que truquen amb molta freqüència'},
  'Auto-confirmar': {en:'Auto-confirm',fr:'Auto-confirmer',pt:'Auto-confirmar',ca:'Auto-confirmar'},
  'Revisar': {en:'Review',fr:'Vérifier',pt:'Rever',ca:'Revisar'},
  'Rechazar': {en:'Reject',fr:'Rejeter',pt:'Rejeitar',ca:'Rebutjar'},
  'Más de': {en:'More than',fr:'Plus de',pt:'Mais de',ca:'Més de'},
  '¿Qué significa cada opción?': {en:'What does each option mean?',fr:'Que signifie chaque option?',pt:'O que significa cada opção?',ca:'Què significa cada opció?'},
  'Confirmar sola': {en:'Confirm on its own',fr:'Confirmer seul',pt:'Confirmar sozinho',ca:'Confirmar sola'},
  'lo gestiona sin avisarte': {en:'handles it without notifying you',fr:'le gère sans vous prévenir',pt:'gere sem avisar',ca:'ho gestiona sense avisar-te'},
  'No aceptar': {en:'Don\'t accept',fr:'Ne pas accepter',pt:'Não aceitar',ca:'No acceptar'},
  'lo rechaza educadamente': {en:'politely declines',fr:'refuse poliment',pt:'recusa educadamente',ca:'ho rebutja educadament'},
  // Config page — orders
  'Alertas de pedidos': {en:'Order alerts',fr:'Alertes de commandes',pt:'Alertas de pedidos',ca:'Alertes de comandes'},
  'Cómo te avisa cuando entra un pedido por teléfono': {en:'How it notifies you when an order comes in by phone',fr:'Comment il vous prévient quand une commande arrive par téléphone',pt:'Como avisa quando entra um pedido por telefone',ca:'Com t\'avisa quan entra una comanda per telèfon'},
  'Cuando un cliente hace un pedido por teléfono, ¿cómo quieres enterarte?': {en:'When a client places a phone order, how do you want to be notified?',fr:'Quand un client passe une commande par téléphone, comment voulez-vous être prévenu?',pt:'Quando um cliente faz um pedido por telefone, como quer saber?',ca:'Quan un client fa una comanda per telèfon, com vols assabentar-te?'},
  'Banner + sonido': {en:'Banner + sound',fr:'Bannière + son',pt:'Banner + som',ca:'Banner + so'},
  'Aparece un aviso arriba de la pantalla con sonido. Toca para ir a pedidos.': {en:'A notification appears at the top with sound. Tap to go to orders.',fr:'Une notification apparaît en haut avec du son. Appuyez pour aller aux commandes.',pt:'Aparece um aviso no topo com som. Toque para ir a pedidos.',ca:'Apareix un avís a dalt amb so. Toca per anar a comandes.'},
  'Ir a pedidos automáticamente': {en:'Go to orders automatically',fr:'Aller aux commandes automatiquement',pt:'Ir a pedidos automaticamente',ca:'Anar a comandes automàticament'},
  'Te cambia directamente a la pantalla de pedidos cuando entra uno nuevo.': {en:'Switches you directly to the orders screen when a new one comes in.',fr:'Vous redirige directement vers l\'écran des commandes.',pt:'Muda diretamente para o ecrã de pedidos quando entra um novo.',ca:'Et canvia directament a la pantalla de comandes quan n\'entra una nova.'},
  'Sin alerta': {en:'No alert',fr:'Sans alerte',pt:'Sem alerta',ca:'Sense alerta'},
  'Solo aparece en el panel como actividad. Sin aviso especial.': {en:'Only appears in the dashboard as activity. No special alert.',fr:'Apparaît uniquement dans le tableau de bord. Pas d\'alerte spéciale.',pt:'Só aparece no painel como atividade. Sem aviso especial.',ca:'Només apareix al panell com a activitat. Sense avís especial.'},
  // Help button
  'Ayuda': {en:'Help',fr:'Aide',pt:'Ajuda',ca:'Ajuda'},
  '¿Qué es': {en:'What is',fr:"Qu'est-ce que",pt:'O que é',ca:'Què és'},
  'Tu recepcionista virtual atiende el teléfono por ti las 24 horas, sin descansos, sin días libres.': {en:'Your virtual receptionist answers the phone for you 24/7, no breaks, no days off.',fr:'Votre réceptionniste virtuel répond au téléphone 24h/24, sans pause.',pt:'O seu rececionista virtual atende o telefone 24h, sem pausas.',ca:'La teva recepcionista virtual atén el telèfon 24h.'},
  'Cuando alguien llama a tu negocio': {en:'When someone calls your business',fr:'Quand quelqu\'un appelle',pt:'Quando alguém liga',ca:'Quan algú truca'},
  'coge el teléfono y saluda': {en:'picks up and greets',fr:'décroche et salue',pt:'atende e cumprimenta',ca:'agafa el telèfon i saluda'},
  'Pregunta qué necesita el cliente': {en:'Asks what the customer needs',fr:'Demande ce dont le client a besoin',pt:'Pergunta o que o cliente precisa',ca:'Pregunta què necessita el client'},
  'Gestiona reservas, pedidos, consultas': {en:'Handles reservations, orders, inquiries',fr:'Gère réservations, commandes, questions',pt:'Gere reservas, pedidos, consultas',ca:'Gestiona reserves, comandes, consultes'},
  'Todo queda guardado en el panel': {en:'Everything is saved in the dashboard',fr:'Tout est sauvegardé dans le tableau de bord',pt:'Tudo fica guardado no painel',ca:'Tot queda guardat al panell'},
  '¿Cuándo confirma': {en:'When does',fr:'Quand',pt:'Quando confirma',ca:'Quan confirma'},
  'sola': {en:'confirm on its own',fr:'confirme seul',pt:'sozinha',ca:'sola'},
  'confirma automáticamente cuando': {en:'confirms automatically when',fr:'confirme automatiquement quand',pt:'confirma automaticamente quando',ca:'confirma automàticament quan'},
  'La reserva es para pocas personas': {en:'The reservation is for few people',fr:'La réservation est pour peu de personnes',pt:'A reserva é para poucas pessoas',ca:'La reserva és per a poques persones'},
  'Hay disponibilidad clara': {en:'Availability is clear',fr:'La disponibilité est claire',pt:'A disponibilidade é clara',ca:'La disponibilitat és clara'},
  'No hay peticiones especiales': {en:'No special requests',fr:'Pas de demandes spéciales',pt:'Sem pedidos especiais',ca:'Sense peticions especials'},
  'te avisa y espera tu revisión cuando': {en:'alerts you and waits for your review when',fr:'vous prévient et attend votre avis quand',pt:'avisa e espera a sua revisão quando',ca:"t'avisa i espera la teva revisió quan"},
  'Es un grupo grande': {en:'Large group',fr:'Grand groupe',pt:'Grupo grande',ca:'Grup gran'},
  'Piden algo especial': {en:'Special request',fr:'Demande spéciale',pt:'Pedem algo especial',ca:'Demanen algo especial'},
  'Mencionan alergias': {en:'Allergies mentioned',fr:'Allergies mentionnées',pt:'Mencionam alergias',ca:'Mencionen al·lèrgies'},
  'Tiene dudas': {en:'Has doubts',fr:'A des doutes',pt:'Tem dúvidas',ca:'Té dubtes'},
  '¿Qué significa "Revísalo tú"?': {en:'What does "Review it yourself" mean?',fr:'Que signifie "À vérifier" ?',pt:'O que significa "Revisa tu"?',ca:'Què significa "Revisa-ho tu"?'},
  'Significa que tu recepcionista recibió la llamada pero prefiere que tú tomes la decisión final.': {en:'It means your receptionist received the call but prefers you make the final decision.',fr:'Cela signifie que votre réceptionniste a reçu l\'appel mais préfère que vous preniez la décision finale.',pt:'Significa que o rececionista recebeu a chamada mas prefere que tome a decisão final.',ca:'Significa que la recepcionista va rebre la trucada però prefereix que tu prenguis la decisió.'},
  'No es un error. Es prudencia.': {en:"It's not an error. It's being careful.",fr:"Ce n'est pas une erreur. C'est de la prudence.",pt:'Não é um erro. É prudência.',ca:'No és un error. És prudència.'},
  '¿Cómo configuro a': {en:'How do I configure',fr:'Comment configurer',pt:'Como configuro',ca:'Com configuro'},
  'Ve a Configuración. Ahí puedes cambiar': {en:'Go to Settings. There you can change',fr:'Allez dans Paramètres. Vous pouvez y modifier',pt:'Vá a Configurações. Lá pode mudar',ca:'Ves a Configuració. Allà pots canviar'},
  'Nombre del negocio y del agente': {en:'Business name and agent name',fr:"Nom de l'entreprise et de l'agent",pt:'Nome do negócio e do agente',ca:'Nom del negoci i de l\'agent'},
  'Qué puede hacer sin preguntarte': {en:'What it can do without asking you',fr:'Ce qu\'il peut faire sans vous demander',pt:'O que pode fazer sem perguntar',ca:'Què pot fer sense preguntar-te'},
  'La información que usa para responder': {en:'The information it uses to answer',fr:"L'information qu'il utilise pour répondre",pt:'A informação que usa para responder',ca:'La informació que usa per respondre'},
  '¿Cómo funcionan las reservas?': {en:'How do reservations work?',fr:'Comment fonctionnent les réservations ?',pt:'Como funcionam as reservas?',ca:'Com funcionen les reserves?'},
  'Las reservas que confirma tu recepcionista aparecen automáticamente. No tienes que hacer nada.': {en:'Reservations confirmed by your receptionist appear automatically. You don\'t need to do anything.',fr:'Les réservations confirmées apparaissent automatiquement.',pt:'As reservas confirmadas aparecem automaticamente.',ca:'Les reserves confirmades apareixen automàticament.'},
  'Consejos': {en:'Tips',fr:'Conseils',pt:'Dicas',ca:'Consells'},
  'Rellena bien la carta y los horarios': {en:'Fill in the menu and hours properly',fr:'Remplissez bien le menu et les horaires',pt:'Preencha bem o menu e os horários',ca:'Omple bé la carta i els horaris'},
  'Revisa las llamadas de vez en cuando': {en:'Review calls from time to time',fr:'Vérifiez les appels de temps en temps',pt:'Revise as chamadas de vez em quando',ca:'Revisa les trucades de tant en tant'},
  'Si comete un error, corrígelo — aprenderá': {en:"If it makes a mistake, correct it — it'll learn",fr:"S'il fait une erreur, corrigez — il apprendra",pt:'Se cometer um erro, corrija — aprenderá',ca:'Si comet un error, corregeix-lo — aprendrà'},
  'No dejes la carta vacía': {en:"Don't leave the menu empty",fr:'Ne laissez pas le menu vide',pt:'Não deixe o menu vazio',ca:'No deixis la carta buida'},
  'No te preocupes si tiene dudas al principio': {en:"Don't worry if it has doubts at first",fr:"Ne vous inquiétez pas s'il a des doutes au début",pt:'Não se preocupe se tiver dúvidas no início',ca:'No et preocupis si té dubtes al principi'},
  // Dynamic agent name labels
  'lo confirmó': {en:'confirmed it',fr:"l'a confirmé",pt:'confirmou',ca:'ho va confirmar'},
  'ha aprendido algo nuevo': {en:'has learned something new',fr:'a appris quelque chose de nouveau',pt:'aprendeu algo novo',ca:'ha après alguna cosa nova'},
  'tuvo dudas': {en:'had doubts',fr:'a eu des doutes',pt:'teve dúvidas',ca:'va tenir dubtes'},
  // 'Lo que hizo' already defined above
  'Elige la opción correcta y': {en:'Choose the correct option and',fr:"Choisissez l'option correcte et",pt:'Escolha a opção correta e',ca:'Tria la opció correcta i'},
  'aprenderá para la próxima vez.': {en:"will learn for next time.",fr:'apprendra pour la prochaine fois.',pt:'aprenderá para a próxima vez.',ca:'aprendrà per a la pròxima vegada.'},
  'Listo': {en:'Done',fr:'Fait',pt:'Feito',ca:'Fet'},
  'tendrá esto en cuenta la próxima vez': {en:'will keep this in mind next time',fr:'en tiendra compte la prochaine fois',pt:'terá isto em conta na próxima vez',ca:'tindrà això en compte la pròxima vegada'},
  'ha detectado': {en:'has detected',fr:'a détecté',pt:'detetou',ca:'ha detectat'},
  'No podía atenderse': {en:'Could not be handled',fr:"Ne pouvait pas être traité",pt:'Não podia ser atendido',ca:'No podia atendre-se'},
  'Necesita tu atención': {en:'Needs your attention',fr:'Nécessite votre attention',pt:'Precisa da sua atenção',ca:'Necessita la teva atenció'},
  'Sin información suficiente': {en:'Not enough information',fr:"Pas assez d'information",pt:'Informação insuficiente',ca:'Informació insuficient'},
  'Mencionó alergias': {en:'Mentioned allergies',fr:'A mentionné des allergies',pt:'Mencionou alergias',ca:'Ha mencionat al·lèrgies'},
  'Pidió mesa concreta': {en:'Requested specific table',fr:'A demandé une table spécifique',pt:'Pediu mesa específica',ca:'Ha demanat taula concreta'},
  'No había hueco': {en:'No availability',fr:'Pas de disponibilité',pt:'Não havia vaga',ca:'No hi havia lloc'},
  'Quería cambiar algo': {en:'Wanted to change something',fr:'Voulait changer quelque chose',pt:'Queria mudar algo',ca:'Volia canviar algo'},
  'Quería cancelar': {en:'Wanted to cancel',fr:'Voulait annuler',pt:'Queria cancelar',ca:'Volia cancel·lar'},
  'Ocasión especial': {en:'Special occasion',fr:'Occasion spéciale',pt:'Ocasião especial',ca:'Ocasió especial'},
  'Necesidades especiales': {en:'Special needs',fr:'Besoins spéciaux',pt:'Necessidades especiais',ca:'Necessitats especials'},
  'Avisó que llega tarde': {en:'Notified late arrival',fr:'A prévenu d\'un retard',pt:'Avisou que chega tarde',ca:'Ha avisat que arriba tard'},
  'Pedía algo que no ofrecemos': {en:'Requested something we don\'t offer',fr:'Demandait quelque chose que nous n\'offrons pas',pt:'Pedia algo que não oferecemos',ca:'Demanava algo que no oferim'},
  'Cliente con dudas': {en:'Confused customer',fr:'Client confus',pt:'Cliente com dúvidas',ca:'Client amb dubtes'},
  'Patrón repetido': {en:'Repeat pattern',fr:'Schéma répété',pt:'Padrão repetido',ca:'Patró repetit'},
}

export function tx(text: string, locale: string): string {
  if (!locale || locale === 'es') return text
  return TX[text]?.[locale] || text
}

/** Common UI strings that are scattered everywhere */
export function getCommonStrings(locale: string = 'es') {
  const t = getTranslations(locale)
  return {
    today: locale === 'es' ? 'Hoy' : locale === 'en' ? 'Today' : locale === 'fr' ? "Aujourd'hui" : locale === 'pt' ? 'Hoje' : 'Avui',
    people: locale === 'es' ? 'personas' : locale === 'en' ? 'people' : locale === 'fr' ? 'personnes' : locale === 'pt' ? 'pessoas' : 'persones',
    noData: locale === 'es' ? 'Sin datos' : locale === 'en' ? 'No data' : locale === 'fr' ? 'Pas de données' : locale === 'pt' ? 'Sem dados' : 'Sense dades',
    recentCalls: locale === 'es' ? 'Llamadas recientes' : locale === 'en' ? 'Recent calls' : locale === 'fr' ? 'Appels récents' : locale === 'pt' ? 'Chamadas recentes' : 'Trucades recents',
    viewAll: locale === 'es' ? 'Ver todas →' : locale === 'en' ? 'View all →' : locale === 'fr' ? 'Voir tout →' : locale === 'pt' ? 'Ver todas →' : 'Veure totes →',
    manage: locale === 'es' ? 'Gestionar →' : locale === 'en' ? 'Manage →' : locale === 'fr' ? 'Gérer →' : locale === 'pt' ? 'Gerir →' : 'Gestionar →',
    saveChanges: locale === 'es' ? 'Guardar cambios' : locale === 'en' ? 'Save changes' : locale === 'fr' ? 'Enregistrer' : locale === 'pt' ? 'Guardar alterações' : 'Desar canvis',
    callBack: locale === 'es' ? 'Llamar de vuelta' : locale === 'en' ? 'Call back' : locale === 'fr' ? 'Rappeler' : locale === 'pt' ? 'Ligar de volta' : 'Tornar a trucar',
    noCalls: locale === 'es' ? 'Sin llamadas aún' : locale === 'en' ? 'No calls yet' : locale === 'fr' ? "Pas d'appels" : locale === 'pt' ? 'Sem chamadas' : 'Sense trucades',
    noClients: locale === 'es' ? 'Sin clientes' : locale === 'en' ? 'No clients' : locale === 'fr' ? 'Pas de clients' : locale === 'pt' ? 'Sem clientes' : 'Sense clients',
    noActivity: locale === 'es' ? 'Sin actividad registrada' : locale === 'en' ? 'No activity recorded' : locale === 'fr' ? 'Aucune activité' : locale === 'pt' ? 'Sem atividade' : 'Sense activitat',
    forecast: locale === 'es' ? 'Así pinta hoy' : locale === 'en' ? "Today's forecast" : locale === 'fr' ? "Prévision du jour" : locale === 'pt' ? 'Previsão de hoje' : 'Previsió avui',
    callsTotal: locale === 'es' ? 'llamadas en total' : locale === 'en' ? 'total calls' : locale === 'fr' ? 'appels au total' : locale === 'pt' ? 'chamadas no total' : 'trucades en total',
  }
}

export const SUPPORTED_LOCALES: { code: Locale; name: string; flag: string }[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ca', name: 'Català', flag: '🏴' },
]
