export type StatusType = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export function statusIcon(status: StatusType): string {
  switch (status) {
    case 'completed': return '✓';
    case 'running':   return '⟳';
    case 'failed':    return '✗';
    case 'skipped':   return '⏭';
    case 'pending':
    default:          return '○';
  }
}

export function statusColor(status: StatusType): string {
  switch (status) {
    case 'completed': return 'green';
    case 'running':   return 'cyan';
    case 'failed':    return 'red';
    case 'skipped':   return 'yellow';
    case 'pending':
    default:          return 'gray';
  }
}
