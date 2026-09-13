import { BigInt } from '@graphprotocol/graph-ts';
import {
  EventCancelled,
  EventCreated,
  EventJoined,
  EventLeft,
} from '../../generated/EventRegistry/EventRegistry';
import { Event, EventParticipant } from '../../generated/schema';

function participantId(eventId: string, participant: string): string {
  return eventId.concat('-').concat(participant);
}

export function handleEventCreated(event: EventCreated): void {
  const eventId = event.params.eventId.toString();

  const evt = new Event(eventId);
  evt.host = event.params.host;
  evt.title = event.params.title;
  evt.description = event.params.description;
  evt.sportType = event.params.sportType;
  evt.startTime = event.params.startTime;
  evt.endTime = event.params.endTime;
  evt.distanceGoal = event.params.distanceGoal;
  evt.startLat = event.params.startLat;
  evt.startLng = event.params.startLng;
  evt.participantCount = BigInt.fromI32(1);
  evt.createdAt = event.params.createdAt;
  evt.active = true;
  evt.save();

  const participant = new EventParticipant(participantId(eventId, event.params.host.toHexString()));
  participant.event = eventId;
  participant.user = event.params.host;
  participant.joinedAt = event.params.createdAt;
  participant.active = true;
  participant.save();
}

export function handleEventJoined(event: EventJoined): void {
  const eventId = event.params.eventId.toString();
  const evt = Event.load(eventId);
  if (!evt) return;

  evt.participantCount = event.params.participantCount;
  evt.save();

  const id = participantId(eventId, event.params.participant.toHexString());
  let participant = EventParticipant.load(id);
  if (!participant) {
    participant = new EventParticipant(id);
    participant.event = eventId;
    participant.user = event.params.participant;
  }
  participant.joinedAt = event.block.timestamp;
  participant.active = true;
  participant.save();
}

export function handleEventLeft(event: EventLeft): void {
  const eventId = event.params.eventId.toString();
  const evt = Event.load(eventId);
  if (!evt) return;

  evt.participantCount = event.params.participantCount;
  evt.save();

  const participant = EventParticipant.load(participantId(eventId, event.params.participant.toHexString()));
  if (participant) {
    participant.active = false;
    participant.save();
  }
}

export function handleEventCancelled(event: EventCancelled): void {
  const eventId = event.params.eventId.toString();
  const evt = Event.load(eventId);
  if (!evt) return;

  evt.active = false;
  evt.participantCount = BigInt.fromI32(0);
  evt.save();
}