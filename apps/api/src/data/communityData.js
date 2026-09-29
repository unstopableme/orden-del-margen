const communities = [
  {
    id: 'casa-azul',
    name: 'Casa Azul',
    area: 'Centro',
    description: 'A shared space for neighbors coordinating care, events, and local resources.',
    propertyId: 1
  },
  {
    id: 'viviendas-del-sol',
    name: 'Viviendas del Sol',
    area: 'Parque Norte',
    description: 'A growing community focused on welcoming members and caring for shared spaces.',
    propertyId: 2
  }
];

const members = [
  {
    id: 'member-1',
    displayName: 'María Sol',
    handle: '@mariasol',
    bio: 'Community gardener and welcome guide.',
    status: 'Helping neighbors settle in',
    role: 'member',
    points: 280,
    level: 3,
    badges: ['Welcome guide', 'Garden keeper'],
    communityIds: ['casa-azul']
  },
  {
    id: 'member-2',
    displayName: 'Diego Norte',
    handle: '@diegonorte',
    bio: 'Organizes local events and resource swaps.',
    status: 'Planning the next resource swap',
    role: 'moderator',
    points: 460,
    level: 5,
    badges: ['Event host', 'Resource builder'],
    communityIds: ['casa-azul', 'viviendas-del-sol']
  }
];

const referrals = [
  {
    id: 'referral-1',
    referrerId: 'member-1',
    inviteeName: 'Alex Rivera',
    status: 'joined',
    rewardPoints: 100
  },
  {
    id: 'referral-2',
    referrerId: 'member-1',
    inviteeName: 'Jordan Lee',
    status: 'invited',
    rewardPoints: 0
  }
];

const progressionEvents = [
  {
    id: 'event-1',
    memberId: 'member-1',
    type: 'referral_completed',
    label: 'A referral joined the community',
    points: 100,
    createdAt: '2026-09-27T16:30:00.000Z'
  },
  {
    id: 'event-2',
    memberId: 'member-1',
    type: 'welcome_post',
    label: 'Welcomed a new neighbor',
    points: 25,
    createdAt: '2026-09-26T13:15:00.000Z'
  }
];

const announcements = [
  {
    id: 'announcement-1',
    communityId: 'casa-azul',
    title: 'Saturday courtyard care',
    body: 'Join us for a one-hour shared-space care session. Bring gloves if you have them.',
    author: 'Diego Norte',
    createdAt: '2026-09-28T09:00:00.000Z',
    pinned: true
  },
  {
    id: 'announcement-2',
    communityId: 'casa-azul',
    title: 'Welcome to the new member circle',
    body: 'Introduce yourself and share one skill or resource you would like to exchange.',
    author: 'María Sol',
    createdAt: '2026-09-25T18:00:00.000Z',
    pinned: false
  },
  {
    id: 'announcement-3',
    communityId: 'viviendas-del-sol',
    title: 'Resource swap interest check',
    body: 'Tell the community what household or neighborhood resources you can share.',
    author: 'Diego Norte',
    createdAt: '2026-09-24T15:00:00.000Z',
    pinned: false
  }
];

const properties = [
  {
    id: 1,
    name: 'Casa Azul',
    area: 'Centro',
    type: 'Residential community',
    status: 'Active',
    communityId: 'casa-azul',
    summary: 'Four-unit community with a shared courtyard and monthly care gatherings.',
    operationsNote: 'Shared courtyard care is coordinated through the community feed.'
  },
  {
    id: 2,
    name: 'Viviendas del Sol',
    area: 'Parque Norte',
    type: 'Apartment community',
    status: 'Active',
    communityId: 'viviendas-del-sol',
    summary: 'A twelve-unit community with shared resources and neighbor-led events.',
    operationsNote: 'Community updates and events are posted by moderators.'
  }
];

module.exports = {
  announcements,
  communities,
  members,
  properties,
  progressionEvents,
  referrals
};
