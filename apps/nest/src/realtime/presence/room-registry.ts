// In-memory room membership and presence state.
//
// Pure TypeScript with no socket.io dependency so the interesting cases
// (identity swaps, disconnect cleanup, roster snapshots) are testable directly.
// The gateway owns the actual fan-out; this owns what is true.

import type { PresenceEntry, PresenceParticipant } from "./presence-protocol";

interface RoomMember {
  entry: PresenceEntry | null;
}

/** A presence entry that is no longer current and must be retracted. */
export interface PresenceRetraction {
  roomId: string;
  participantId: string;
}

export class RoomRegistry {
  private readonly members = new Map<string, Map<string, RoomMember>>();
  private readonly socketRooms = new Map<string, Set<string>>();

  /** Idempotent. Returns false when the socket was already a member. */
  join(socketId: string, roomId: string): boolean {
    const room = this.members.get(roomId) ?? new Map<string, RoomMember>();
    this.members.set(roomId, room);

    const rooms = this.socketRooms.get(socketId) ?? new Set<string>();
    rooms.add(roomId);
    this.socketRooms.set(socketId, rooms);

    if (room.has(socketId)) return false;
    room.set(socketId, { entry: null });
    return true;
  }

  isMember(socketId: string, roomId: string): boolean {
    return this.members.get(roomId)?.has(socketId) ?? false;
  }

  /**
   * Record a participant's position in a room. Returns the participant id that
   * must be retracted first when a socket changes identity mid-session, so the
   * room never shows a stale ghost.
   */
  setPresence(
    socketId: string,
    roomId: string,
    entry: PresenceEntry,
  ): { supersededParticipantId: string | null } | null {
    const room = this.members.get(roomId);
    const member = room?.get(socketId);
    if (!room || !member) return null;

    const previousParticipantId = member.entry?.participant.id ?? null;
    const supersededParticipantId =
      previousParticipantId !== null &&
      previousParticipantId !== entry.participant.id
        ? previousParticipantId
        : null;

    member.entry = entry;
    return { supersededParticipantId };
  }

  /** Returns the participant id that stopped being present, if any. */
  clearPresence(socketId: string, roomId: string): string | null {
    const member = this.members.get(roomId)?.get(socketId);
    if (!member?.entry) return null;

    const participantId = member.entry.participant.id;
    member.entry = null;
    return participantId;
  }

  /** Removes the socket from one room. Returns the retraction it implies. */
  leave(socketId: string, roomId: string): PresenceRetraction | null {
    const room = this.members.get(roomId);
    const member = room?.get(socketId);

    this.socketRooms.get(socketId)?.delete(roomId);
    if (this.socketRooms.get(socketId)?.size === 0) {
      this.socketRooms.delete(socketId);
    }

    if (!room || !member) return null;
    room.delete(socketId);
    if (room.size === 0) this.members.delete(roomId);

    const participantId = member.entry?.participant.id ?? null;
    return participantId === null ? null : { roomId, participantId };
  }

  /** Removes a disconnected socket everywhere. Returns every retraction owed. */
  leaveAll(socketId: string): PresenceRetraction[] {
    const rooms = Array.from(this.socketRooms.get(socketId) ?? []);
    const retractions: PresenceRetraction[] = [];

    for (const roomId of rooms) {
      const retraction = this.leave(socketId, roomId);
      if (retraction) retractions.push(retraction);
    }

    this.socketRooms.delete(socketId);
    return retractions;
  }

  roomsFor(socketId: string): string[] {
    return Array.from(this.socketRooms.get(socketId) ?? []);
  }

  memberCount(roomId: string): number {
    return this.members.get(roomId)?.size ?? 0;
  }

  /**
   * Current presence in a room, for replaying to a socket that just joined.
   * The joining socket is excluded: it already knows about itself.
   */
  snapshot(roomId: string, excludeSocketId?: string): PresenceEntry[] {
    const room = this.members.get(roomId);
    if (!room) return [];

    const entries: PresenceEntry[] = [];
    room.forEach((member, socketId) => {
      if (socketId === excludeSocketId || !member.entry) return;
      entries.push(member.entry);
    });
    return entries;
  }

  participants(roomId: string): PresenceParticipant[] {
    return this.snapshot(roomId).map((entry) => entry.participant);
  }
}
