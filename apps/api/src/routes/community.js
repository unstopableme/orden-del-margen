const express = require('express');
const data = require('../data/communityData');
const { createCommunityAuthenticator } = require('../auth/communityAuth');
const {
  MemoryRateLimitStore,
  configuredRateLimits,
  createRateLimitMiddleware
} = require('../rateLimit');

function forbidden(res, message = 'You are not allowed to perform this action') {
  return res.status(403).json({ error: { code: 'FORBIDDEN', message } });
}

function requestedAnotherMember(req, field) {
  return req.body[field] !== undefined && req.body[field] !== req.callerContext.memberId;
}

function findMember(memberId) {
  return data.members.find((member) => member.id === memberId);
}

function publicMember(member) {
  return {
    id: member.id,
    displayName: member.displayName,
    handle: member.handle,
    bio: member.bio,
    topics: [...member.topics],
    status: member.status,
    role: member.role,
    points: member.points,
    knowledgeScore: member.knowledgeScore || 0,
    level: member.level,
    badges: [...member.badges],
    progressToNextLevel: member.points % 100,
    nextLevelAt: member.level * 100
  };
}

function addProgression(member, eventType, label, points) {
  member.points += points;
  member.level = Math.floor(member.points / 100) + 1;
  if (eventType === 'knowledge_pvp') {
    member.knowledgeScore = (member.knowledgeScore || 0) + points;
  }
  data.progressionEvents.push({
    id: `event-${data.progressionEvents.length + 1}`,
    memberId: member.id,
    type: eventType,
    label,
    points,
    createdAt: new Date().toISOString()
  });
}

function createCommunityRouter({
  authenticate = createCommunityAuthenticator(),
  persistence = null,
  rateLimitStore = new MemoryRateLimitStore(),
  rateLimits
} = {}) {
  const router = express.Router();
  const defaultRateLimits = configuredRateLimits();
  const effectiveRateLimits = {
    authentication: { ...defaultRateLimits.authentication, ...rateLimits?.authentication },
    authenticated: { ...defaultRateLimits.authenticated, ...rateLimits?.authenticated },
    rewards: { ...defaultRateLimits.rewards, ...rateLimits?.rewards }
  };
  const authenticationAttemptLimit = createRateLimitMiddleware({
    store: rateLimitStore,
    bucket: 'community-auth-attempts',
    subject: (req) => req.ip,
    ...effectiveRateLimits.authentication
  });
  const authenticatedLimit = createRateLimitMiddleware({
    store: rateLimitStore,
    bucket: 'community-authenticated',
    ...effectiveRateLimits.authenticated
  });
  const knowledgeRewardLimit = createRateLimitMiddleware({
    store: rateLimitStore,
    bucket: 'community-knowledge-rewards',
    ...effectiveRateLimits.rewards
  });
  const questRewardLimit = createRateLimitMiddleware({
    store: rateLimitStore,
    bucket: 'community-quest-rewards',
    ...effectiveRateLimits.rewards
  });

router.get('/dashboard', authenticationAttemptLimit, authenticate, authenticatedLimit, (req, res) => {
  const memberId = req.callerContext.memberId;
  if (req.query.memberId && req.query.memberId !== memberId) {
    return forbidden(res, 'A member may only view their own dashboard');
  }
  const member = findMember(memberId);

  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }

  const communityIds = new Set(member.communityIds);
  const memberCommunities = data.communities.filter((community) =>
    communityIds.has(community.id)
  );
  const communityAnnouncements = data.announcements
    .filter((announcement) => communityIds.has(announcement.communityId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const memberReferrals = data.referrals.filter(
    (referral) => referral.referrerId === member.id
  );
  const memberEvents = data.progressionEvents
    .filter((event) => event.memberId === member.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    member: publicMember(member),
    communities: memberCommunities,
    announcements: communityAnnouncements,
    properties: data.properties.filter((property) =>
      communityIds.has(property.communityId)
    ),
    referrals: memberReferrals,
    progressionEvents: memberEvents,
    quests: data.quests.filter((quest) => communityIds.has(quest.communityId)),
    coffeeGifts: data.coffeeGifts.filter(
      (gift) => gift.senderId === member.id || gift.recipientId === member.id
    ),
    knowledgeLeaderboard: data.members
      .map((item) => ({
        memberId: item.id,
        displayName: item.displayName,
        points: item.knowledgeScore || 0
      }))
      .sort((a, b) => b.points - a.points)
  });
});

router.get('/members/:id', (req, res) => {
  const member = findMember(req.params.id);

  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }

  res.json(publicMember(member));
});

router.patch('/members/:id/status', authenticationAttemptLimit, authenticate, authenticatedLimit, async (req, res, next) => {
  if (req.params.id !== req.callerContext.memberId) {
    return forbidden(res, 'A member may only update their own status');
  }
  const member = findMember(req.params.id);
  const status =
    typeof req.body.status === 'string' ? req.body.status.trim() : '';

  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }

  if (!status || status.length > 120) {
    return res
      .status(400)
      .json({ message: 'Status must be between 1 and 120 characters' });
  }

  try {
    if (persistence) await persistence.updateStatus(member.id, status);
    member.status = status;
    return res.json(publicMember(member));
  } catch (error) {
    return next(error);
  }
});

router.get('/me/properties', authenticationAttemptLimit, authenticate, authenticatedLimit, (req, res) => {
  if (!req.callerContext.walletAddress || !Array.isArray(req.callerContext.properties)) {
    return forbidden(res, 'A verified Passport wallet binding is required');
  }
  return res.json({
    walletAddress: req.callerContext.walletAddress,
    data: req.callerContext.properties
  });
});

router.patch('/members/:id/profile', authenticationAttemptLimit, authenticate, authenticatedLimit, async (req, res, next) => {
  if (req.params.id !== req.callerContext.memberId) {
    return forbidden(res, 'A member may only update their own profile');
  }
  const member = findMember(req.params.id);
  const displayName =
    typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
  const bio = typeof req.body.bio === 'string' ? req.body.bio.trim() : '';
  const topics = Array.isArray(req.body.topics)
    ? req.body.topics.filter(
        (topic) => typeof topic === 'string' && topic.trim().length <= 60
      )
    : null;

  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }

  if (
    !displayName ||
    displayName.length > 120 ||
    bio.length > 280 ||
    !topics ||
    topics.length > 8
  ) {
    return res.status(400).json({
      message: 'Profile requires a name, up to 280 bio characters, and up to 8 topics'
    });
  }

  try {
    if (persistence) await persistence.updateProfile(member.id, { displayName, bio, topics });
    member.displayName = displayName;
    member.bio = bio;
    member.topics = topics;
    return res.json(publicMember(member));
  } catch (error) {
    return next(error);
  }
});

router.post('/referrals', authenticationAttemptLimit, authenticate, authenticatedLimit, async (req, res, next) => {
  if (requestedAnotherMember(req, 'referrerId')) {
    return forbidden(res, 'A member may only create their own referrals');
  }
  const referrerId = req.callerContext.memberId;
  const inviteeName =
    typeof req.body.inviteeName === 'string' ? req.body.inviteeName.trim() : '';
  const member = findMember(referrerId);

  if (!member) {
    return res.status(404).json({ message: 'Referrer not found' });
  }

  if (!inviteeName || inviteeName.length > 80) {
    return res
      .status(400)
      .json({ message: 'Invitee name must be between 1 and 80 characters' });
  }

  let persistedId;
  try {
    persistedId = persistence ? await persistence.createReferral(referrerId, inviteeName) : null;
  } catch (error) {
    return next(error);
  }
  const referral = {
    id: persistedId || `referral-${data.referrals.length + 1}`,
    referrerId,
    inviteeName,
    status: 'invited',
    rewardPoints: 0
  };
  data.referrals.push(referral);
  res.status(201).json(referral);
});

router.get('/quests', (req, res) => {
  const communityId = req.query.communityId;
  const quests = communityId
    ? data.quests.filter((quest) => quest.communityId === communityId)
    : data.quests;
  res.json({ data: quests });
});

router.post('/quests/:id/resolve', authenticationAttemptLimit, authenticate, authenticatedLimit, questRewardLimit, async (req, res, next) => {
  if (requestedAnotherMember(req, 'memberId')) {
    return forbidden(res, 'A member may not resolve a quest for another member');
  }
  const quest = data.quests.find((item) => item.id === req.params.id);
  const member = findMember(req.callerContext.memberId);

  if (!quest) {
    return res.status(404).json({ message: 'Quest not found' });
  }
  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }
  if (!member.communityIds.includes(quest.communityId)) {
    return forbidden(res, 'Community membership is required to resolve this quest');
  }
  if (persistence) {
    try {
      const result = await persistence.resolveQuest(member.id, quest.id);
      await persistence.reload(data);
      if (result.status === 'forbidden') {
        return forbidden(res, 'Community membership is required to resolve this quest');
      }
      if (result.status === 'already_resolved') {
        return res.status(409).json({ message: 'Quest is already resolved' });
      }
      if (result.status === 'not_found') {
        return res.status(404).json({ message: 'Quest or member not found' });
      }
      return res.json({ quest: data.quests.find((item) => item.id === req.params.id),
        member: publicMember(findMember(member.id)) });
    } catch (error) {
      return next(error);
    }
  }
  if (quest.status !== 'open') {
    return res.status(409).json({ message: 'Quest is already resolved' });
  }

  quest.status = 'resolved';
  quest.resolvedBy = member.id;
  addProgression(member, 'community_quest', `Resolved quest: ${quest.title}`, quest.points);
  res.json({ quest, member: publicMember(member) });
});

router.post('/coffee-gifts', authenticationAttemptLimit, authenticate, authenticatedLimit, async (req, res, next) => {
  if (requestedAnotherMember(req, 'senderId')) {
    return forbidden(res, 'A member may only send gifts as themselves');
  }
  const sender = findMember(req.callerContext.memberId);
  const recipient = findMember(req.body.recipientId);
  const message =
    typeof req.body.message === 'string' ? req.body.message.trim() : '';

  if (!sender || !recipient) {
    return res.status(404).json({ message: 'Sender or recipient not found' });
  }
  if (sender.id === recipient.id || !message || message.length > 240) {
    return res.status(400).json({
      message: 'Coffee gifts need two different members and a message up to 240 characters'
    });
  }

  let persisted;
  try {
    persisted = persistence ? await persistence.createGift(sender.id, recipient.id, message) : null;
  } catch (error) {
    return next(error);
  }
  const gift = {
    id: persisted?.id || `coffee-gift-${data.coffeeGifts.length + 1}`,
    senderId: sender.id,
    recipientId: recipient.id,
    message,
    createdAt: persisted?.createdAt || new Date().toISOString()
  };
  data.coffeeGifts.push(gift);
  res.status(201).json(gift);
});

router.get('/games/knowledge/challenges', (req, res) => {
  res.json({
    data: data.knowledgeChallenges.map(({ correctOption, ...challenge }) => challenge)
  });
});

router.post('/games/knowledge/answers', authenticationAttemptLimit, authenticate, authenticatedLimit, knowledgeRewardLimit, async (req, res, next) => {
  if (requestedAnotherMember(req, 'memberId')) {
    return forbidden(res, 'A member may not answer for another member');
  }
  const challenge = data.knowledgeChallenges.find(
    (item) => item.id === req.body.challengeId
  );
  const member = findMember(req.callerContext.memberId);
  const option = Number(req.body.option);

  if (!challenge || !member) {
    return res.status(404).json({ message: 'Challenge or member not found' });
  }
  if (!Number.isInteger(option) || option < 0 || option >= challenge.options.length) {
    return res.status(400).json({ message: 'Option is invalid' });
  }

  if (persistence) {
    try {
      const result = await persistence.awardKnowledge(member.id, challenge.id, option);
      await persistence.reload(data);
      if (result.status === 'not_found') {
        return res.status(404).json({ message: 'Challenge or member not found' });
      }
      const currentMember = findMember(member.id);
      return res.json({
        correct: result.status !== 'incorrect',
        pointsAwarded: result.status === 'awarded' ? challenge.points : 0,
        alreadyRewarded: result.status === 'already_rewarded',
        member: publicMember(currentMember)
      });
    } catch (error) {
      return next(error);
    }
  }

  const correct = option === challenge.correctOption;
  if (correct) {
    const existingAward = data.knowledgeAwards.find(
      (award) => award.memberId === member.id && award.challengeId === challenge.id
    );
    if (existingAward) {
      return res.json({
        correct: true,
        pointsAwarded: 0,
        alreadyRewarded: true,
        member: publicMember(member)
      });
    }

    data.knowledgeAwards.push({
      memberId: member.id,
      challengeId: challenge.id,
      points: challenge.points,
      createdAt: new Date().toISOString()
    });
    addProgression(
      member,
      'knowledge_pvp',
      `Answered a ${challenge.topic} knowledge challenge`,
      challenge.points
    );
  }
  res.json({
    correct,
    pointsAwarded: correct ? challenge.points : 0,
    alreadyRewarded: false,
    member: publicMember(member)
  });
});

router.get('/communities/:communityId/announcements', (req, res) => {
  const community = data.communities.find(
    (item) => item.id === req.params.communityId
  );

  if (!community) {
    return res.status(404).json({ message: 'Community not found' });
  }

  res.json({
    community,
    data: data.announcements.filter(
      (announcement) => announcement.communityId === community.id
    )
  });
});

router.get('/properties', (req, res) => {
  res.json({ data: data.properties });
});

  return router;
}

module.exports = createCommunityRouter();
module.exports.createCommunityRouter = createCommunityRouter;
module.exports.publicMember = publicMember;
