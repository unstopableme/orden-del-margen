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
    dateOfBirth: '1990-04-12',
    ageVerified: true,
    membershipPlanId: 'free',
    displayName: 'María Sol',
    handle: '@mariasol',
    bio: 'Community gardener and welcome guide.',
    topics: ['coffee', 'planet care', 'creature protection'],
    status: 'Helping neighbors settle in',
    role: 'member',
    points: 280,
    knowledgeScore: 120,
    level: 3,
    badges: ['Welcome guide', 'Garden keeper'],
    communityIds: ['casa-azul']
  },
  {
    id: 'member-2',
    dateOfBirth: '1987-11-03',
    ageVerified: true,
    membershipPlanId: 'free',
    displayName: 'Diego Norte',
    handle: '@diegonorte',
    bio: 'Organizes local events and resource swaps.',
    topics: ['coffee', 'planet care', 'knowledge games'],
    status: 'Planning the next resource swap',
    role: 'moderator',
    points: 460,
    knowledgeScore: 180,
    level: 5,
    badges: ['Event host', 'Resource builder'],
    communityIds: ['casa-azul', 'viviendas-del-sol']
  }
];

const membershipPlans = [
  {
    id: 'free',
    name: 'Traveler',
    price: 0,
    interval: 'forever',
    description: 'Explore the community, join knowledge games, and follow public quests.',
    features: ['Member profile and status', 'Community announcements', 'Knowledge games and quests'],
    availability: 'available'
  },
  {
    id: 'paid-community',
    name: 'Café Circle',
    price: 9,
    interval: 'month',
    description: 'A future paid community tier for deeper educational and social programming.',
    features: ['Everything in Traveler', 'Small-group learning circles', 'Member-only story sessions'],
    availability: 'interest_only'
  },
  {
    id: 'paid-steward',
    name: 'Steward Circle',
    price: 25,
    interval: 'month',
    description: 'A future supporter tier for expanded workshops and community project participation.',
    features: ['Everything in Café Circle', 'Steward workshops', 'Community project briefings'],
    availability: 'interest_only'
  }
];

const membershipInterest = [];

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

const quests = [
  {
    id: 'quest-1',
    communityId: 'casa-azul',
    title: 'Restore the pollinator corner',
    description: 'Coordinate a native-plant care session and share one way to protect local creatures.',
    topic: 'creature protection',
    points: 120,
    status: 'open',
    resolvedBy: null
  },
  {
    id: 'quest-2',
    communityId: 'casa-azul',
    title: 'Map a low-waste coffee morning',
    description: 'Collect reusable-cup and composting tips from three neighbors.',
    topic: 'coffee',
    points: 80,
    status: 'open',
    resolvedBy: null
  }
];

const coffeeGifts = [
  {
    id: 'coffee-gift-1',
    senderId: 'member-2',
    recipientId: 'member-1',
    message: 'Thanks for welcoming our new neighbors.',
    createdAt: '2026-09-28T10:15:00.000Z'
  }
];

const knowledgeChallenges = [
  {
    id: 'knowledge-1',
    topic: 'planet care',
    question: 'Which action usually reduces household food waste most directly?',
    options: ['Buying more packaging', 'Planning portions and using leftovers', 'Leaving food uncovered'],
    correctOption: 1,
    points: 50
  },
  {
    id: 'knowledge-2',
    topic: 'creature protection',
    question: 'What helps pollinators in a shared garden?',
    options: ['Native flowering plants', 'Removing all ground cover', 'Using bright lights overnight'],
    correctOption: 0,
    points: 50
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
  coffeeGifts,
  communities,
  knowledgeChallenges,
  membershipInterest,
  membershipPlans,
  members,
  properties,
  progressionEvents,
  quests,
  referrals
};
