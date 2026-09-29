const express = require('express');
const data = require('../data/communityData');

const router = express.Router();

function findMember(memberId) {
  return data.members.find((member) => member.id === memberId);
}

function publicMember(member) {
  return {
    ...member,
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

router.get('/dashboard', (req, res) => {
  const memberId = req.query.memberId || 'member-1';
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

router.patch('/members/:id/status', (req, res) => {
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

  member.status = status;
  res.json(publicMember(member));
});

router.patch('/members/:id/profile', (req, res) => {
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

  member.displayName = displayName;
  member.bio = bio;
  member.topics = topics;
  res.json(publicMember(member));
});

router.post('/referrals', (req, res) => {
  const referrerId = req.body.referrerId;
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

  const referral = {
    id: `referral-${data.referrals.length + 1}`,
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

router.post('/quests/:id/resolve', (req, res) => {
  const quest = data.quests.find((item) => item.id === req.params.id);
  const member = findMember(req.body.memberId);

  if (!quest) {
    return res.status(404).json({ message: 'Quest not found' });
  }
  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }
  if (quest.status !== 'open') {
    return res.status(409).json({ message: 'Quest is already resolved' });
  }

  quest.status = 'resolved';
  quest.resolvedBy = member.id;
  addProgression(member, 'community_quest', `Resolved quest: ${quest.title}`, quest.points);
  res.json({ quest, member: publicMember(member) });
});

router.post('/coffee-gifts', (req, res) => {
  const sender = findMember(req.body.senderId);
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

  const gift = {
    id: `coffee-gift-${data.coffeeGifts.length + 1}`,
    senderId: sender.id,
    recipientId: recipient.id,
    message,
    createdAt: new Date().toISOString()
  };
  data.coffeeGifts.push(gift);
  res.status(201).json(gift);
});

router.get('/games/knowledge/challenges', (req, res) => {
  res.json({
    data: data.knowledgeChallenges.map(({ correctOption, ...challenge }) => challenge)
  });
});

router.post('/games/knowledge/answers', (req, res) => {
  const challenge = data.knowledgeChallenges.find(
    (item) => item.id === req.body.challengeId
  );
  const member = findMember(req.body.memberId);
  const option = Number(req.body.option);

  if (!challenge || !member) {
    return res.status(404).json({ message: 'Challenge or member not found' });
  }
  if (!Number.isInteger(option) || option < 0 || option >= challenge.options.length) {
    return res.status(400).json({ message: 'Option is invalid' });
  }

  const correct = option === challenge.correctOption;
  if (correct) {
    addProgression(
      member,
      'knowledge_pvp',
      `Answered a ${challenge.topic} knowledge challenge`,
      challenge.points
    );
  }
  res.json({ correct, pointsAwarded: correct ? challenge.points : 0, member: publicMember(member) });
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

module.exports = router;
