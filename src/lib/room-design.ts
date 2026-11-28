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

export interface PlanPoint {
    x: number;
    y: number;
}

export interface FurniturePlacements {
    sofa: PlanPoint;
    sideTable: PlanPoint;
    plant: PlanPoint;
}

export function getDefaultFurniturePlacements(widthM: number, lengthM: number): FurniturePlacements {
    return {
        sofa: { x: widthM * 0.46, y: lengthM * 0.56 },
        sideTable: { x: widthM * 0.76, y: lengthM * 0.68 },
        plant: { x: widthM * 0.16, y: lengthM * 0.18 },
    };
}

export function validateFurniturePlacements(
    placements: FurniturePlacements,
    widthM: number,
    lengthM: number,
): string | null {
    for (const [label, point, halfWidthM, halfLengthM] of [
        ['Sofa', placements.sofa, Math.min(1, widthM * 0.4), Math.min(0.45, lengthM * 0.35)],
        ['Side table', placements.sideTable, Math.min(0.4, widthM * 0.18), Math.min(0.325, lengthM * 0.18)],
        ['Plant', placements.plant, Math.min(0.2, widthM * 0.12), Math.min(0.2, lengthM * 0.12)],
    ] as const) {
        if (
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y) ||
            point.x < halfWidthM ||
            point.x > widthM - halfWidthM ||
            point.y < halfLengthM ||
            point.y > lengthM - halfLengthM
        ) {
            return `Keep the ${label.toLowerCase()} fully inside the room boundaries.`;
        }
    }

    return null;
}

function wallLength(geometry: RoomGeometry, wall: RoomWall): number {
    return wall === 'north' || wall === 'south' ? geometry.widthM : geometry.lengthM;
}

function isRoomWall(wall: string): wall is RoomWall {
    return ['north', 'east', 'south', 'west'].includes(wall);
}

/** Map an opening's wall offset to normalized top-down plan coordinates. */
export function getOpeningPlanPoint(
    wall: string,
    offsetM: number,
    widthM: number,
    lengthM: number,
): PlanPoint | null {
    if (!isRoomWall(wall) || !Number.isFinite(offsetM)) return null;

    const wallLengthM = wall === 'north' || wall === 'south' ? widthM : lengthM;
    if (!Number.isFinite(wallLengthM) || wallLengthM <= 0 || offsetM < 0 || offsetM > wallLengthM) {
        return null;
    }

    const position = offsetM / wallLengthM;
    switch (wall) {
        case 'north':
            return { x: position, y: 0 };
        case 'east':
            return { x: 1, y: position };
        case 'south':
            return { x: 1 - position, y: 1 };
        case 'west':
            return { x: 0, y: 1 - position };
    }
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
