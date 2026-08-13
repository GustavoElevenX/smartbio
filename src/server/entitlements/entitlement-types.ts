export type PlanSource="system"|"manual"|"billing";export type PlanStatus="active"|"suspended"|"expired";
export interface WorkspaceEntitlements{workspaceId:string;plan:{key:string;name:string;source:PlanSource;status:PlanStatus;endsAt?:string};features:Record<string,{enabled:boolean;limit?:number;used?:number;remaining?:number;source:"plan"|"override"}>}
export class EntitlementError extends Error{readonly status=403;constructor(public readonly code:"entitlement_required"|"plan_limit_reached",public readonly feature:string,message:string){super(message);}}
