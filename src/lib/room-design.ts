export type RoomWall = 'north' | 'east' | 'south' | 'west';
export type WindowWall = RoomWall | 'none';

export interface RoomGeometry {
    widthM: number;
    lengthM: number;
    heightM: number;
    doorWall: string;
    doorOffsetM: number;
    windowWall: string;
    windowOffsetM: number | null;
}

function wallLength(geometry: RoomGeometry, wall: RoomWall): number {
    return wall === 'north' || wall === 'south' ? geometry.widthM : geometry.lengthM;
}

function isRoomWall(wall: string): wall is RoomWall {
    return ['north', 'east', 'south', 'west'].includes(wall);
}

/** Return a user-facing validation message, or null when the confirmed room geometry is plausible. */
export function validateRoomGeometry(geometry: RoomGeometry): string | null {
    if (!Number.isFinite(geometry.widthM) || geometry.widthM < 2 || geometry.widthM > 15) {
        return 'Room width must be between 2 and 15 metres.';
    }
    if (!Number.isFinite(geometry.lengthM) || geometry.lengthM < 2 || geometry.lengthM > 15) {
        return 'Room length must be between 2 and 15 metres.';
    }
    if (!Number.isFinite(geometry.heightM) || geometry.heightM < 2.1 || geometry.heightM > 5) {
        return 'Wall height must be between 2.1 and 5 metres.';
    }

    if (!isRoomWall(geometry.doorWall)) {
        return 'Choose a valid wall for the door.';
    }
    const doorLength = wallLength(geometry, geometry.doorWall);
    if (
        !Number.isFinite(geometry.doorOffsetM) ||
        geometry.doorOffsetM < 0.45 ||
        geometry.doorOffsetM > doorLength - 0.45
    ) {
        return 'Place the door centre at least 0.45 metres from either end of its wall.';
    }

    if (geometry.windowWall === 'none') return geometry.windowOffsetM === null
        ? null
        : 'Clear the window offset when no window wall is selected.';

    if (!isRoomWall(geometry.windowWall)) {
        return 'Choose a valid wall for the window.';
    }
    const windowLength = wallLength(geometry, geometry.windowWall);
    if (
        geometry.windowOffsetM === null ||
        !Number.isFinite(geometry.windowOffsetM) ||
        geometry.windowOffsetM < 0.6 ||
        geometry.windowOffsetM > windowLength - 0.6
    ) {
        return 'Place the window centre at least 0.6 metres from either end of its wall.';
    }
    if (
        geometry.windowWall === geometry.doorWall &&
        Math.abs(geometry.windowOffsetM - geometry.doorOffsetM) < 1.1
    ) {
        return 'Move the window farther from the door on that wall.';
    }

    return null;
}
