import { Bytes } from '@graphprotocol/graph-ts';
import { KudosGiven, KudosRevoked, CommentAdded } from '../../generated/SocialRegistry/SocialRegistry';
import { Activity, ActivityKudos, ActivityComment } from '../../generated/schema';
import { getOrCreateProfile } from '../helpers';

export function handleKudosGiven(event: KudosGiven): void {
  const activityId = event.params.activityId.toString();
  const giverAddress = event.params.giver;
  const id = Bytes.fromUTF8(activityId).concat(Bytes.fromUTF8('-')).concat(giverAddress);

  const activity = Activity.load(Bytes.fromUTF8(activityId));
  if (!activity) return;

  const kudos = new ActivityKudos(id);
  kudos.activity = activity.id;
  kudos.giver = getOrCreateProfile(giverAddress).id;
  kudos.givenAt = event.params.timestamp;
  kudos.active = true;
  kudos.save();
}

export function handleKudosRevoked(event: KudosRevoked): void {
  const activityId = event.params.activityId.toString();
  const giverAddress = event.params.giver;
  const id = Bytes.fromUTF8(activityId).concat(Bytes.fromUTF8('-')).concat(giverAddress);

  const kudos = ActivityKudos.load(id);
  if (!kudos) return;
  kudos.active = false;
  kudos.save();
}

export function handleCommentAdded(event: CommentAdded): void {
  const activityId = event.params.activityId.toString();
  const commentId = event.params.commentId;

  const activity = Activity.load(Bytes.fromUTF8(activityId));
  if (!activity) return;

  const comment = new ActivityComment(commentId);
  comment.activity = activity.id;
  comment.author = getOrCreateProfile(event.params.author).id;
  comment.cid = event.params.commentCid;
  comment.createdAt = event.params.timestamp;
  comment.save();
}
