import { describe, expect, it } from 'vitest';
import { validateRoomGeometry, type RoomGeometry } from './room-design';

const validRoom: RoomGeometry = {
    widthM: 4.8,
    lengthM: 3.6,
    heightM: 2.7,
    doorWall: 'south',
    doorOffsetM: 1.2,
    windowWall: 'north',
    windowOffsetM: 2.4,
};

describe('validateRoomGeometry', () => {
    it('accepts user-confirmed dimensions and separated openings', () => {
        expect(validateRoomGeometry(validRoom)).toBeNull();
    });

    it('accepts a room without a window', () => {
        expect(validateRoomGeometry({ ...validRoom, windowWall: 'none', windowOffsetM: null })).toBeNull();
    });

    it('rejects dimensions outside the supported room range', () => {
        expect(validateRoomGeometry({ ...validRoom, widthM: 1.5 })).toContain('width');
    });

    it('rejects door positions too close to a wall corner', () => {
        expect(validateRoomGeometry({ ...validRoom, doorOffsetM: 0.2 })).toContain('door centre');
    });

    it('rejects a window that overlaps the door on the same wall', () => {
        expect(validateRoomGeometry({
            ...validRoom,
            doorWall: 'north',
            doorOffsetM: 1.2,
            windowWall: 'north',
            windowOffsetM: 1.8,
        })).toContain('farther from the door');
    });
});
