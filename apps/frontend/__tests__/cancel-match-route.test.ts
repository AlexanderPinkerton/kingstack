// import { describe, it, beforeEach, expect, vi, type Mock } from 'vitest';
// import { PUT as cancelMatch } from '../src/app/api/match/cancel/route';
// import prisma from '@/lib/prisma';
// import { getUserAuthDetails } from '@/lib/admin-utils';

// // --- Prisma Singleton Mock ---
// vi.mock('@/lib/prisma', () => {
//   const mockPrisma: any = {
//     user: {
//       update: vi.fn(),
//     },
//     match: {
//       findUnique: vi.fn(),
//       update: vi.fn(),
//     },
//     match_user_data: {
//       updateMany: vi.fn(),
//     },
//     $transaction: vi.fn(),
//   };
//   return { default: mockPrisma };
// });

// // --- getUserAuthDetails Mock ---
// vi.mock('@/lib/admin-utils', () => ({
//   getUserAuthDetails: vi.fn(),
// }));

// // --- Test Data ---
// const fakeUser = {
//   id: 'user1',
//   available_scrilla: 100000,
//   total_bet_scrilla: 50000,
// };

// const fakeMatch = {
//   id: 'match1',
//   bet_amount: 50000,
//   pot_amount: 50000,
//   status: 'PENDING',
//   game_id: 'SLIPPI',
//   match_data: [
//     {
//       id: 'mud1',
//       match_id: 'match1',
//       user_id: 'user1',
//       is_creator: true,
//       status: 'ACCEPT',
//       user: fakeUser,
//     },
//     {
//       id: 'mud2',
//       match_id: 'match1',
//       user_id: 'user2',
//       is_creator: false,
//       status: 'PENDING',
//       user: { id: 'user2', available_scrilla: 100000 },
//     },
//   ],
// };

// function mockRequest(body: any, headers: Record<string, string> = {}) {
//   return {
//     json: async () => body,
//     headers: {
//       get: (key: string) => headers[key],
//     },
//   } as any;
// }

// describe('PUT /api/match/cancel', () => {
//   beforeEach(() => {
//     vi.clearAllMocks();
//     (prisma.match.findUnique as any).mockResolvedValue(fakeMatch);
//     (prisma.match.update as any).mockResolvedValue({ ...fakeMatch, status: 'CLOSED' });
//     (prisma.match_user_data.updateMany as any).mockResolvedValue({ count: 2 });
//     (prisma.user.update as any).mockResolvedValue({ ...fakeUser });

//     // Mock transaction to execute the callback function
//     (prisma.$transaction as any).mockImplementation(async (callback: any) => {
//       const tx = {
//         match: { update: prisma.match.update },
//         match_user_data: { updateMany: prisma.match_user_data.updateMany },
//         user: { update: prisma.user.update },
//       };
//       return await callback(tx);
//     });

//     (getUserAuthDetails as any).mockResolvedValue({
//       isAuthenticated: true,
//       userId: 'user1',
//       userEmail: 'user1@example.com',
//     });
//   });

//   it('successfully cancels a match when user is the creator', async () => {
//     const req = mockRequest({ matchId: 'match1' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);
//     const json = await res.json();

//     expect(res.status).toBe(200);
//     expect(json.success).toBe(true);
//     expect(json.message).toBe('Match cancelled successfully');
//     expect(json.refundedAmount).toBe(fakeMatch.bet_amount);

//     // Verify transaction was called
//     expect(prisma.$transaction).toHaveBeenCalledTimes(1);
//     expect(prisma.match.update).toHaveBeenCalledTimes(1);
//     expect(prisma.match_user_data.updateMany).toHaveBeenCalledTimes(1);
//     expect(prisma.user.update).toHaveBeenCalledTimes(1);
//   });

//   it('refunds the creator when cancelling a match', async () => {
//     let updatedData: any = {};
//     (prisma.user.update as any).mockImplementation(async ({ data }: { data: any }) => {
//       updatedData = data;
//       return { ...fakeUser, ...data };
//     });

//     const req = mockRequest({ matchId: 'match1' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(200);
//     expect(updatedData.available_scrilla).toEqual({ increment: fakeMatch.bet_amount });
//   });

//   it('updates match status to CLOSED when cancelling', async () => {
//     let matchUpdateData: any = {};
//     (prisma.match.update as any).mockImplementation(async ({ data }: { data: any }) => {
//       matchUpdateData = data;
//       return { ...fakeMatch, ...data };
//     });

//     const req = mockRequest({ matchId: 'match1' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(200);
//     expect(matchUpdateData.status).toBe('CLOSED');
//   });

//   it('updates all match_user_data statuses to CANCELLED', async () => {
//     let updateManyData: any = {};
//     (prisma.match_user_data.updateMany as any).mockImplementation(async ({ data }: { data: any }) => {
//       updateManyData = data;
//       return { count: 2 };
//     });

//     const req = mockRequest({ matchId: 'match1' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(200);
//     expect(updateManyData.status).toBe('CANCELLED');
//   });

//   it('rejects if user is not authenticated', async () => {
//     (getUserAuthDetails as any).mockResolvedValue({
//       isAuthenticated: false,
//       error: 'No JWT token provided',
//     });
//     const req = mockRequest({ matchId: 'match1' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(403);
//     const json = await res.json();
//     expect(json).toBe('Unauthorized');
//   });

//   it('rejects if matchId is not provided', async () => {
//     const req = mockRequest({}, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(400);
//     const json = await res.json();
//     expect(json).toBe('Match ID is required');
//   });

//   it('rejects if match is not found', async () => {
//     (prisma.match.findUnique as any).mockResolvedValue(null);
//     const req = mockRequest({ matchId: 'nonexistent' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(404);
//     const json = await res.json();
//     expect(json).toBe('Match not found');
//   });

//   it('rejects if user is not the creator', async () => {
//     const matchWithDifferentCreator = {
//       ...fakeMatch,
//       match_data: [
//         {
//           id: 'mud1',
//           match_id: 'match1',
//           user_id: 'user2', // Different creator
//           is_creator: true,
//           status: 'ACCEPT',
//           user: { id: 'user2' },
//         },
//         {
//           id: 'mud2',
//           match_id: 'match1',
//           user_id: 'user1', // Current user is opponent
//           is_creator: false,
//           status: 'PENDING',
//           user: fakeUser,
//         },
//       ],
//     };
//     (prisma.match.findUnique as any).mockResolvedValue(matchWithDifferentCreator);

//     const req = mockRequest({ matchId: 'match1' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(403);
//     const json = await res.json();
//     expect(json).toBe('Only the match creator can cancel this match');
//   });

//   it('rejects if match is no longer pending', async () => {
//     const activeMatch = { ...fakeMatch, status: 'ACTIVE' };
//     (prisma.match.findUnique as any).mockResolvedValue(activeMatch);

//     const req = mockRequest({ matchId: 'match1' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(400);
//     const json = await res.json();
//     expect(json).toBe('Cannot cancel match - opponent has already accepted');
//   });

//   it('rejects if opponent has already accepted', async () => {
//     const matchWithAcceptedOpponent = {
//       ...fakeMatch,
//       match_data: [
//         {
//           id: 'mud1',
//           match_id: 'match1',
//           user_id: 'user1',
//           is_creator: true,
//           status: 'ACCEPT',
//           user: fakeUser,
//         },
//         {
//           id: 'mud2',
//           match_id: 'match1',
//           user_id: 'user2',
//           is_creator: false,
//           status: 'ACCEPT', // Opponent has accepted
//           user: { id: 'user2' },
//         },
//       ],
//     };
//     (prisma.match.findUnique as any).mockResolvedValue(matchWithAcceptedOpponent);

//     const req = mockRequest({ matchId: 'match1' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(400);
//     const json = await res.json();
//     expect(json).toBe('Cannot cancel match - opponent has already accepted');
//   });

//   it('rejects if opponent has already joined (for SLIPPI games)', async () => {
//     const matchWithJoinedOpponent = {
//       ...fakeMatch,
//       match_data: [
//         {
//           id: 'mud1',
//           match_id: 'match1',
//           user_id: 'user1',
//           is_creator: true,
//           status: 'ACCEPT',
//           user: fakeUser,
//         },
//         {
//           id: 'mud2',
//           match_id: 'match1',
//           user_id: 'user2',
//           is_creator: false,
//           status: 'JOIN', // Opponent has joined
//           user: { id: 'user2' },
//         },
//       ],
//     };
//     (prisma.match.findUnique as any).mockResolvedValue(matchWithJoinedOpponent);

//     const req = mockRequest({ matchId: 'match1' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(400);
//     const json = await res.json();
//     expect(json).toBe('Cannot cancel match - opponent has already accepted');
//   });

//   it('handles database errors gracefully', async () => {
//     (prisma.match.findUnique as any).mockRejectedValue(new Error('Database error'));

//     const req = mockRequest({ matchId: 'match1' }, { Authorization: 'Bearer mocktoken' });
//     const res = await cancelMatch(req);

//     expect(res.status).toBe(500);
//     const json = await res.json();
//     expect(json).toBe('Internal server error');
//   });
// });
