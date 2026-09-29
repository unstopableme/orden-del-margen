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
    progressionEvents: memberEvents
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
