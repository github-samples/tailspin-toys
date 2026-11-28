import type { FurniturePlacements, RoomGeometry } from './room-design';

interface Point2D {
    x: number;
    y: number;
}

function polygon(
    context: CanvasRenderingContext2D,
    points: Point2D[],
    fill: string | CanvasGradient,
    stroke: string,
): void {
    const [first, ...rest] = points;
    if (!first) return;
    context.beginPath();
    context.moveTo(first.x, first.y);
    rest.forEach((point) => context.lineTo(point.x, point.y));
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.stroke();
}

export function drawRoomPreview(
    context: CanvasRenderingContext2D,
    geometry: RoomGeometry,
    placements: FurniturePlacements,
): void {
    const { width: canvasWidth, height: canvasHeight } = context.canvas;
    const roomWidth = geometry.widthM;
    const roomLength = geometry.lengthM;
    const roomHeight = geometry.heightM;
    const scale = Math.min(
        (canvasWidth * 0.62) / (roomWidth + roomLength),
        (canvasHeight * 0.38) / (roomHeight + (roomWidth + roomLength) * 0.46),
    );
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight * 0.54;
    const project = (x: number, y: number, z: number): Point2D => ({
        x: centerX + ((x - roomWidth / 2) - (y - roomLength / 2)) * scale,
        y: centerY + ((x - roomWidth / 2) + (y - roomLength / 2)) * scale * 0.46 - z * scale * 0.9,
    });

    const background = context.createLinearGradient(0, 0, canvasWidth, canvasHeight);
    background.addColorStop(0, '#111827');
    background.addColorStop(1, '#020617');
    context.fillStyle = background;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    context.fillStyle = '#f8fafc';
    context.font = '600 30px system-ui, sans-serif';
    context.fillText('Intero · room concept', 54, 60);
    context.fillStyle = '#cbd5e1';
    context.font = '18px system-ui, sans-serif';
    context.fillText(`${roomWidth.toFixed(2)} m × ${roomLength.toFixed(2)} m × ${roomHeight.toFixed(2)} m`, 56, 92);

    const floorShade = context.createLinearGradient(0, canvasHeight * 0.25, 0, canvasHeight * 0.75);
    floorShade.addColorStop(0, '#c2a983');
    floorShade.addColorStop(1, '#735f49');
    polygon(context, [
        project(0, 0, 0),
        project(roomWidth, 0, 0),
        project(roomWidth, roomLength, 0),
        project(0, roomLength, 0),
    ], floorShade, '#94a3b8');
    polygon(context, [
        project(0, 0, roomHeight),
        project(roomWidth, 0, roomHeight),
        project(roomWidth, 0, 0),
        project(0, 0, 0),
    ], '#334155', '#94a3b8');
    polygon(context, [
        project(roomWidth, 0, roomHeight),
        project(roomWidth, roomLength, roomHeight),
        project(roomWidth, roomLength, 0),
        project(roomWidth, 0, 0),
    ], '#1e293b', '#94a3b8');

    const openingWidth = (wall: string): number => wall === 'north' || wall === 'south'
        ? roomWidth
        : roomLength;
    const drawOpening = (wall: string, offset: number, label: string, color: string, bottomM: number, heightM: number): void => {
        let x1 = 0;
        let y1 = 0;
        let x2 = 0;
        let y2 = 0;
        const halfWidth = Math.min(wall === 'north' || wall === 'south' ? 0.5 : 0.6, openingWidth(wall) / 5);
        if (wall === 'north') {
            x1 = Math.max(0, offset - halfWidth); x2 = Math.min(roomWidth, offset + halfWidth);
        } else if (wall === 'east') {
            y1 = Math.max(0, offset - halfWidth); y2 = Math.min(roomLength, offset + halfWidth); x1 = roomWidth; x2 = roomWidth;
        } else if (wall === 'south') {
            x1 = Math.max(0, roomWidth - offset - halfWidth); x2 = Math.min(roomWidth, roomWidth - offset + halfWidth); y1 = roomLength; y2 = roomLength;
        } else {
            y1 = Math.max(0, roomLength - offset - halfWidth); y2 = Math.min(roomLength, roomLength - offset + halfWidth);
        }
        polygon(context, [
            project(x1, y1, bottomM),
            project(x2, y2, bottomM),
            project(x2, y2, bottomM + heightM),
            project(x1, y1, bottomM + heightM),
        ], color, '#e2e8f0');
        const center = project((x1 + x2) / 2, (y1 + y2) / 2, bottomM + heightM + 0.12);
        context.fillStyle = '#f8fafc';
        context.font = '14px system-ui, sans-serif';
        context.fillText(label, center.x + 8, center.y);
    };

    drawOpening(geometry.doorWall, geometry.doorOffsetM, 'Door', '#b7794b', 0, Math.min(2.1, roomHeight * 0.78));
    if (geometry.windowWall !== 'none' && geometry.windowOffsetM !== null) {
        drawOpening(geometry.windowWall, geometry.windowOffsetM, 'Window', '#38bdf8', Math.min(0.9, roomHeight * 0.35), Math.min(1.2, roomHeight * 0.4));
    }

    const sofaSize = { width: Math.min(2, roomWidth * 0.42), depth: Math.min(0.9, roomLength * 0.32), height: Math.min(0.85, roomHeight * 0.34) };
    const rugPoints = [
        project(placements.sofa.x - sofaSize.width * 0.7, placements.sofa.y - sofaSize.depth * 0.9, 0.04),
        project(placements.sofa.x + sofaSize.width * 0.7, placements.sofa.y - sofaSize.depth * 0.9, 0.04),
        project(placements.sofa.x + sofaSize.width * 0.7, placements.sofa.y + sofaSize.depth * 1.15, 0.04),
        project(placements.sofa.x - sofaSize.width * 0.7, placements.sofa.y + sofaSize.depth * 1.15, 0.04),
    ];
    polygon(context, rugPoints, '#64748b', '#cbd5e1');

    const drawBox = (
        point: { x: number; y: number },
        width: number,
        depth: number,
        height: number,
        topColor: string,
        sideColor: string,
        frontColor: string,
    ): void => {
        const x1 = Math.max(0, point.x - width / 2);
        const x2 = Math.min(roomWidth, point.x + width / 2);
        const y1 = Math.max(0, point.y - depth / 2);
        const y2 = Math.min(roomLength, point.y + depth / 2);
        polygon(context, [project(x2, y1, 0), project(x2, y2, 0), project(x2, y2, height), project(x2, y1, height)], sideColor, '#cbd5e1');
        polygon(context, [project(x1, y2, 0), project(x2, y2, 0), project(x2, y2, height), project(x1, y2, height)], frontColor, '#cbd5e1');
        polygon(context, [project(x1, y1, height), project(x2, y1, height), project(x2, y2, height), project(x1, y2, height)], topColor, '#e2e8f0');
    };

    const objects = [
        { point: placements.sofa, order: placements.sofa.x + placements.sofa.y, draw: () => drawBox(placements.sofa, sofaSize.width, sofaSize.depth, sofaSize.height, '#718879', '#34483e', '#52685a') },
        { point: placements.sideTable, order: placements.sideTable.x + placements.sideTable.y, draw: () => drawBox(placements.sideTable, Math.min(0.8, roomWidth * 0.18), Math.min(0.65, roomLength * 0.18), 0.48, '#c9a878', '#674b35', '#8b684a') },
        { point: placements.plant, order: placements.plant.x + placements.plant.y, draw: () => drawBox(placements.plant, Math.min(0.38, roomWidth * 0.12), Math.min(0.38, roomLength * 0.12), 0.42, '#b9825c', '#76523c', '#946548') },
    ].sort((a, b) => a.order - b.order);
    objects.forEach((object) => object.draw());

    const plantTop = project(placements.plant.x, placements.plant.y, 1.05);
    context.fillStyle = '#7d9a77';
    context.beginPath();
    context.ellipse(plantTop.x, plantTop.y, 18, 30, -0.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#a8bd93';
    context.beginPath();
    context.ellipse(plantTop.x - 12, plantTop.y + 8, 14, 23, 0.5, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#cbd5e1';
    context.font = '15px system-ui, sans-serif';
    context.fillText('Illustrative concept · furniture positions follow your edits · not CAD or a photo', 54, canvasHeight - 38);
}
