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
