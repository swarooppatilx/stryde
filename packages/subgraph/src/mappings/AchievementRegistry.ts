import { AchievementDefined, AchievementMinted } from '../../generated/AchievementRegistry/AchievementRegistry';
import { Achievement, AchievementDefinition } from '../../generated/schema';
import { getOrCreateProfile } from '../helpers';

export function handleAchievementDefined(event: AchievementDefined): void {
  const definition = new AchievementDefinition(event.params.achievementId);
  definition.name = event.params.name;
  definition.save();
}

export function handleAchievementMinted(event: AchievementMinted): void {
  const achievement = new Achievement(event.params.tokenId.toString());
  achievement.recipient = getOrCreateProfile(event.params.recipient).id;
  achievement.achievementId = event.params.achievementId;
  achievement.definition = event.params.achievementId;
  achievement.mintedAt = event.block.timestamp;
  achievement.save();
}
