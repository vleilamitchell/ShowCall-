import { PositionAssignments } from './PositionAssignments';

export function PositionDetail({ departmentId, positionId, onChanged }: { departmentId: string; positionId: string; onChanged?: () => void }) {
  return (
    <PositionAssignments departmentId={departmentId} positionId={positionId} onChanged={onChanged} />
  );
}

export default PositionDetail;


