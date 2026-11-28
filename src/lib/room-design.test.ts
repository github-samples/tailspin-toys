import { describe, expect, it } from 'vitest';
import {
    getDefaultFurniturePlacements,
    getOpeningPlanPoint,
    validateFurniturePlacements,
    validateRoomGeometry,
    type FurniturePlacements,
    type RoomGeometry,
    type RoomWall,
} from './room-design';

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

describe('getOpeningPlanPoint', () => {
    it.each([
        ['north', 2, { x: 0.5, y: 0 }],
        ['east', 1.5, { x: 1, y: 0.5 }],
        ['south', 2, { x: 0.5, y: 1 }],
        ['west', 1.5, { x: 0, y: 0.5 }],
    ] as const)('maps a %s wall offset into the top-down plan', (wall: RoomWall, offsetM: number, point) => {
        expect(getOpeningPlanPoint(wall, offsetM, 4, 3)).toEqual(point);
    });

    it('returns null for invalid walls or offsets outside the selected wall', () => {
        expect(getOpeningPlanPoint('none', 1, 4, 3)).toBeNull();
        expect(getOpeningPlanPoint('east', 3.1, 4, 3)).toBeNull();
        expect(getOpeningPlanPoint('north', Number.NaN, 4, 3)).toBeNull();
    });
});

describe('furniture placements', () => {
    it('provides default object centres within the measured room', () => {
        const placements = getDefaultFurniturePlacements(4.8, 3.6);
        expect(validateFurniturePlacements(placements, 4.8, 3.6)).toBeNull();
    });

    it('rejects object centres outside the room or with non-finite coordinates', () => {
        const placements: FurniturePlacements = {
            sofa: { x: 4.9, y: 1.8 },
            sideTable: { x: 2, y: 1 },
            plant: { x: Number.NaN, y: 0.5 },
        };
        expect(validateFurniturePlacements(placements, 4.8, 3.6)).toContain('sofa');
    });

    it('keeps the full furniture footprint away from the room edges', () => {
        const placements = getDefaultFurniturePlacements(4.8, 3.6);
        placements.sofa = { x: 0.2, y: 1.8 };
        expect(validateFurniturePlacements(placements, 4.8, 3.6)).toContain('fully inside');
    });
});
