// packages/block-editor/src/utils/math.ts
function getDistanceFromPointToEdge(point, rect, edge) {
  const isHorizontal = edge === "top" || edge === "bottom";
  const { x, y } = point;
  const pointLateralPosition = isHorizontal ? x : y;
  const pointForwardPosition = isHorizontal ? y : x;
  const edgeStart = isHorizontal ? rect.left : rect.top;
  const edgeEnd = isHorizontal ? rect.right : rect.bottom;
  const edgeForwardPosition = rect[edge];
  let edgeLateralPosition;
  if (pointLateralPosition >= edgeStart && pointLateralPosition <= edgeEnd) {
    edgeLateralPosition = pointLateralPosition;
  } else if (pointLateralPosition < edgeEnd) {
    edgeLateralPosition = edgeStart;
  } else {
    edgeLateralPosition = edgeEnd;
  }
  return Math.sqrt(
    (pointLateralPosition - edgeLateralPosition) ** 2 + (pointForwardPosition - edgeForwardPosition) ** 2
  );
}
function getDistanceToNearestEdge(point, rect, allowedEdges = ["top", "bottom", "left", "right"]) {
  let candidateDistance;
  let candidateEdge;
  allowedEdges.forEach((edge) => {
    const distance = getDistanceFromPointToEdge(point, rect, edge);
    if (candidateDistance === void 0 || distance < candidateDistance) {
      candidateDistance = distance;
      candidateEdge = edge;
    }
  });
  return [candidateDistance, candidateEdge];
}
function isPointContainedByRect(point, rect) {
  return rect.left <= point.x && rect.right >= point.x && rect.top <= point.y && rect.bottom >= point.y;
}
function isPointWithinTopAndBottomBoundariesOfRect(point, rect) {
  return rect.top <= point.y && rect.bottom >= point.y;
}
export {
  getDistanceFromPointToEdge,
  getDistanceToNearestEdge,
  isPointContainedByRect,
  isPointWithinTopAndBottomBoundariesOfRect
};
