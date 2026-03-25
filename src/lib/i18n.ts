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

export const SUPPORTED_LOCALES: { code: Locale; name: string; flag: string }[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ca', name: 'Català', flag: '🏴' },
]
